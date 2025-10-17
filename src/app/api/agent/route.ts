// Ensure Node runtime (Cheerio-friendly)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

type SearchResult = { title: string; url: string };
type Sale = {
  source: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  soldAt: string;
  shipping?: number;
};

type TavilyResult = { title: string; url: string };
type ModelSalePayload = {
  source?: unknown;
  title?: unknown;
  price?: unknown;
  currency?: unknown;
  url?: unknown;
  soldAt?: unknown;
  shipping?: unknown;
};
type ModelResponsePayload = {
  sales?: ModelSalePayload[];
  citations?: unknown;
};

function safeJson<T>(s: string | undefined | null): T | null {
  if (!s) return null;
  const trimmed = s
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "");
  try {
    const start = trimmed.indexOf("{");
    if (start >= 0) return JSON.parse(trimmed.slice(start)) as T;
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function parseSearchResults(results: unknown): SearchResult[] {
  if (!Array.isArray(results)) return [];
  return results
    .filter((item): item is TavilyResult => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.title === "string" && typeof candidate.url === "string"
      );
    })
    .map(({ title, url }) => ({ title, url }));
}

function normalizeSale(raw: ModelSalePayload): Sale | null {
  if (
    typeof raw?.title !== "string" ||
    typeof raw?.url !== "string" ||
    raw.price === undefined
  ) {
    return null;
  }

  const price = Number(raw.price);
  if (!Number.isFinite(price)) {
    return null;
  }

  const shippingValue =
    raw.shipping === undefined || raw.shipping === null
      ? 0
      : Number(raw.shipping);
  const shipping = Number.isFinite(shippingValue) ? shippingValue : 0;

  return {
    source: typeof raw.source === "string" ? raw.source : "web",
    title: raw.title,
    price,
    currency: typeof raw.currency === "string" ? raw.currency : "USD",
    url: raw.url,
    soldAt:
      typeof raw.soldAt === "string"
        ? raw.soldAt
        : new Date().toISOString(),
    shipping,
  };
}

async function web_search(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": TAVILY_API_KEY!,
      },
      body: JSON.stringify({ query, max_results: 6 }),
    });
    const payload: unknown = await response.json();
    const results =
      payload && typeof payload === "object"
        ? (payload as { results?: unknown }).results
        : undefined;
    return parseSearchResults(results);
  } catch (err) {
    console.error("[agent] tavily error:", err);
    return [];
  }
}

async function web_fetch(url: string) {
  const html = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 card-price-agent" },
  }).then((x) => x.text());
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 150000);
  return { url, text };
}

function groupByWeek(sales: { soldAt: string; price: number }[]) {
  const map = new Map<string, number[]>();
  for (const s of sales) {
    const d = new Date(s.soldAt);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    const week = Math.floor(
      ((Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) -
        Date.UTC(year, 0, 1)) /
        86400000 +
        new Date(Date.UTC(year, 0, 1)).getUTCDay() +
        1) /
        7
    );
    const key = `${year}-${String(week).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s.price);
  }
  return Array.from(map.entries())
    .map(([week, arr]) => {
      const sorted = arr.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return { week, median: sorted.length ? sorted[mid] : 0, n: arr.length };
    })
    .sort((a, b) => a.week.localeCompare(b.week));
}

const SYSTEM = `
You are CardPriceAgent.
Estimate today's value of any trading card (Pokémon, MTG, sports) using RECENT SOLD prices from public pages.
Steps:
- Reformulate a precise search (set, number, grade/condition, date range).
- From search, pick 2–4 promising sources (eBay sold results, TCGplayer market/sales, Cardmarket sold pages, auction results).
- Extract SOLD comps with: title, price, currency, sold date (ISO if present), URL; ignore lots/bundles/proxy/damaged unless asked; respect dateFrom/dateTo.
- Convert prices to USD (assume USD if unclear). Merge & dedupe by URL. If user specifies grade, prefer graded comps; otherwise separate graded vs raw if mixed.
- Return JSON ONLY: { "sales": [...], "citations": [urls...] } (no prose).
`;

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY || !TAVILY_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY or TAVILY_API_KEY" },
        { status: 500 }
      );
    }

    const { query, dateFrom, dateTo, grade } = await req.json();

    const q = (query || "").toString().trim();
    if (!q) {
      return NextResponse.json({
        worth: { median: null, range: null, count: 0 },
        sales: [],
        timeseries: [],
        citations: [],
        notes:
          "Please enter a specific card (set, number, and optional grade).",
      });
    }

    // 1) initial search
    const searchQ = [
      q,
      grade,
      dateFrom && `since:${dateFrom}`,
      dateTo && `to:${dateTo}`,
    ]
      .filter(Boolean)
      .join(" ");
    const results = await web_search(searchQ);

    // 2) fetch pages
    const pages: Array<{ url: string; text: string }> = [];
    for (const r of results.slice(0, 4)) {
      try {
        pages.push(await web_fetch(r.url));
      } catch (e) {
        console.warn("[agent] fetch failed:", r.url, e);
      }
    }

    // 3) Call OpenAI via REST (no SDK)
    const completion = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: JSON.stringify({
                query: q,
                dateFrom,
                dateTo,
                grade,
                pages: pages.map((p) => ({
                  url: p.url,
                  text: p.text.slice(0, 50000),
                })),
              }),
            },
          ],
        }),
      }
    ).then((r) => r.json());

    let sales: Sale[] = [];
    let citations: string[] = [];

    try {
      const content = completion?.choices?.[0]?.message?.content as
        | string
        | undefined;
      const data = safeJson<ModelResponsePayload>(content);

      if (Array.isArray(data?.sales) && data.sales.length) {
        sales = data.sales
          .map((raw) => normalizeSale(raw))
          .filter((sale): sale is Sale => sale !== null);
      }

      const citationList = Array.isArray(data?.citations)
        ? data.citations.filter(
            (item): item is string => typeof item === "string"
          )
        : [];
      citations = Array.from(new Set<string>(citationList));
    } catch (e) {
      console.error("[agent] parse step failed:", e);
      citations = results.slice(0, 4).map((r: { url: string }) => r.url);
    }

    // 4) estimate — use absolute URL derived from the request
    const origin = new URL(req.url).origin;
    const est = await fetch(`${origin}/api/estimate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sales }),
    }).then((r) => r.json());

    // 5) time series
    const timeseries = groupByWeek(
      sales.map((s) => ({
        soldAt: s.soldAt,
        price: s.price + (s.shipping || 0),
      }))
    );

    return NextResponse.json({
      worth: {
        median: est.median ?? null,
        range: est.range ?? null,
        count: sales.length,
      },
      sales: sales.slice(0, 50),
      timeseries,
      citations: citations.slice(0, 6),
      notes:
        sales.length < 3
          ? "Sparse data; try a more specific card (set/number/grade) or widen the date range."
          : undefined,
    });
  } catch (err) {
    console.error("[agent] unhandled error:", err);
    return NextResponse.json(
      { error: "Agent failed unexpectedly. Check server logs for details." },
      { status: 500 }
    );
  }
}
