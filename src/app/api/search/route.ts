// Node runtime
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

type TavilyResult = {
  title: string;
  url: string;
  content?: string; // snippet
};

export async function POST(req: NextRequest) {
  try {
    if (!TAVILY_API_KEY) {
      return NextResponse.json(
        { error: "Missing TAVILY_API_KEY" },
        { status: 500 }
      );
    }

    const { query, maxResults = 8, includeDomains = [] } = await req.json();

    const q = (query || "").toString().trim();
    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const body: Record<string, any> = {
      api_key: TAVILY_API_KEY, // <-- key must be in the body
      query: q,
      max_results: Math.max(1, Math.min(Number(maxResults) || 8, 20)),
      search_depth: "advanced",
    };

    if (Array.isArray(includeDomains) && includeDomains.length) {
      body.include_domains = includeDomains;
    }

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

    const data = JSON.parse(txt);
    const results: TavilyResult[] = Array.isArray(data?.results)
      ? data.results.map((r: any) => ({
          title: String(r.title || "").slice(0, 200),
          url: String(r.url || ""),
          content: r.content ? String(r.content).slice(0, 400) : undefined,
        }))
      : [];

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/search] unhandled:", err);
    return NextResponse.json({ error: "Unexpected failure" }, { status: 500 });
  }
}
