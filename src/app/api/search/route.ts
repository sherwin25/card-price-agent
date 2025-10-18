// Node runtime
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function getTavilyApiKey() {
  const keyCandidates = [
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_KEY,
    process.env.NEXT_PUBLIC_TAVILY_API_KEY,
  ];

  return keyCandidates.find((k) => typeof k === "string" && k.trim().length > 0);
}

/* ------------ Types ------------ */
type TavilyUiResult = { title: string; url: string; content?: string };

type SearchPayload = {
  query: string;
  maxResults?: number;
};

type TavilyRequestBody = {
  api_key: string;
  query: string;
  max_results: number;
  search_depth: "advanced";
  include_domains: string[];
};

type TavilyApiResult = {
  title?: string;
  url?: string;
  content?: string;
};

type TavilyApiResponse = {
  results?: TavilyApiResult[];
};

/* ----------- Constants ---------- */

// Only allow these hosts (and their subdomains)
const TRUSTED_DOMAINS: string[] = [
  "ebay.com",
  "tcgplayer.com",
  "cardmarket.com",
  "pwccmarketplace.com",
  "goldinauctions.com",
  "ha.com", // Heritage
];

/** Heuristic: does the user query look like a trading-card query? */
function looksLikeCardQuery(q: string): boolean {
  const s = q.toLowerCase();

  // Must include at least one of these “card-ish” tokens
  const mustInclude = [
    // grading & marketplaces
    "psa",
    "bgs",
    "cgc",
    "tcgplayer",
    "cardmarket",
    "ebay",
    // common card terms
    "rc",
    "rookie",
    "holo",
    "hollow",
    "refractor",
    "parallel",
    "auto",
    "patch",
    "alt art",
    // franchises
    "pokemon",
    "pokémon",
    "yugioh",
    "yu-gi-oh",
    "mtg",
    "magic",
    "topps",
    "panini",
    "upper deck",
    "nba",
    "nfl",
    "mlb",
    "nhl",
    "fifa",
    "world cup",
  ];

  // And at least one detail-like pattern (set number or card #)
  const numberLike = /(^|\s)(\d{1,3}\/\d{1,3}|#?\d{1,4})(\s|$)/; // e.g., 186/196 or #150 or 150

  const hasCardToken = mustInclude.some((t) => s.includes(t));
  const hasNumberish = numberLike.test(s);

  // Require card token; number is helpful but not mandatory for broader queries
  return hasCardToken || hasNumberish;
}

/* ----------- Handler ------------ */

export async function POST(req: NextRequest) {
  try {
    const tavilyApiKey = getTavilyApiKey();
    if (!tavilyApiKey) {
      return NextResponse.json(
        {
          error:
            "Missing Tavily API key. Set TAVILY_API_KEY (or TAVILY_KEY) in your environment.",
        },
        { status: 500 }
      );
    }

    const { query, maxResults = 8 } = (await req.json()) as SearchPayload;
    const q = (query || "").toString().trim();

    if (!q) {
      return NextResponse.json({ results: [] });
    }

    // Hard filter: only card-related searches are allowed
    if (!looksLikeCardQuery(q)) {
      return NextResponse.json(
        {
          error:
            "This search is restricted to trading cards. Try something like “Giratina V 186/196 PSA 10” or “Shohei Ohtani Topps Chrome #150 PSA 9”.",
        },
        { status: 400 }
      );
    }

    const body: TavilyRequestBody = {
      api_key: tavilyApiKey,
      query: q,
      max_results: Math.max(1, Math.min(Number(maxResults) || 8, 20)),
      search_depth: "advanced",
      include_domains: TRUSTED_DOMAINS,
    };

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const txt = await res.text();
    if (!res.ok) {
      console.error("[/api/search] Tavily error:", txt);
      return NextResponse.json(
        { error: "Tavily failed", detail: txt },
        { status: 500 }
      );
    }

    const data = JSON.parse(txt) as TavilyApiResponse;

    const results: TavilyUiResult[] = Array.isArray(data?.results)
      ? data.results.map(
          (r): TavilyUiResult => ({
            title: String(r.title ?? "").slice(0, 200),
            url: String(r.url ?? ""),
            content: r.content ? String(r.content).slice(0, 400) : undefined,
          })
        )
      : [];

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/search] unhandled:", err);
    return NextResponse.json({ error: "Unexpected failure" }, { status: 500 });
  }
}
