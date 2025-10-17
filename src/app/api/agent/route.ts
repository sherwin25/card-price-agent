// Ensure Node runtime (Cheerio-friendly)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

/**
 * NOTE:
 * This version is deterministic: it ONLY uses eBay SOLD results (public HTML) and does NOT call the OpenAI API.
 * Result: no hallucinated URLs, better price reliability for portfolio/demo.
 * Later, you can re-add Tavily + LLM extraction as an optional fallback.
 */

/* ----------------------------- Types & Helpers ---------------------------- */

type Sale = {
  source: "ebay";
  title: string;
  price: number;
  currency: "USD";
  url: string;
  soldAt: string; // ISO date if known
  shipping?: number;
};

function parsePrice(text: string): number | null {
  if (!text) return null;
  // Accept forms like "$199.99", "US $199.99", "$199", etc.
  const m = text.replace(/\s+/g, " ").match(/\$?\s*([\d,]+(\.\d{1,2})?)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseUsd(text: string): boolean {
  if (!text) return false;
  // We only keep USD results to avoid FX issues.
  return /\bUS\b|\$/.test(text);
}

function parseSoldDate(text: string): string | "" {
  // eBay often shows: "Sold Oct 10, 2025" or "Sold 10/10/25"
  const soldMatch = text.match(
    /Sold\s+([A-Za-z]{3}\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i
  );
  if (!soldMatch) return "";
  const raw = soldMatch[1];
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

function withinRange(iso: string | undefined, from?: string, to?: string) {
  if (!iso) return true; // if unknown, allow; estimator and UI can note sparsity
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  if (from && t < Date.parse(from)) return false;
  if (to && t > Date.parse(to)) return false;
  return true;
}

function matchesGrade(title: string, grade?: string) {
  if (!grade) return true;
  const g = grade.toLowerCase();
  const t = (title || "").toLowerCase();
  return t.includes(g);
}

function dedupeByUrl<T extends { url: string }>(arr: T[]) {
  const seen = new Set<string>();
  return arr.filter((x) => {
    if (!x.url) return false;
    const key = x.url.split("?")[0]; // strip query params for dedupe
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

/* ---------------------------- eBay SOLD Scraper --------------------------- */

function buildEbaySoldUrl(query: string, grade?: string) {
  // Build a Completed + Sold listings search, sort by "End date, recent first".
  // _sop=13 => Best Match? We can omit or change to 12 (End date: newest first) but eBay sometimes ignores sop values.
  const kw = [query, grade].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    _nkw: kw,
    LH_Sold: "1",
    LH_Complete: "1",
    // _sop: "12",
    // Category filters could be added if needed.
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

async function fetchEbaySold(
  query: string,
  dateFrom?: string,
  dateTo?: string,
  grade?: string
): Promise<Sale[]> {
  const url = buildEbaySoldUrl(query, grade);
  const html = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 card-price-agent" },
  }).then((x) => x.text());

  const $ = cheerio.load(html);
  const items: Sale[] = [];

  $("li.s-item").each((_, el) => {
    const $el = $(el);

    const title = $el.find(".s-item__title").text().trim();
    const link = $el.find("a.s-item__link").attr("href") || "";
    const priceText = $el.find(".s-item__price").first().text().trim();
    const shipText = $el
      .find(".s-item__shipping, .s-item__logisticsCost")
      .first()
      .text()
      .trim();
    // Date sometimes appears near captions:
    const captionText = $el
      .find(".s-item__caption--time-end, .s-item__title--tag, .s-item__caption")
      .text();

    // Validate USD
    if (!parseUsd(priceText)) return;

    const price = parsePrice(priceText);
    if (!price || price <= 0 || price >= 100000) return;

    const shipping = parsePrice(shipText) || undefined;
    const soldAt = parseSoldDate(captionText) || ""; // may be empty if eBay omits it

    const sale: Sale = {
      source: "ebay",
      title,
      price,
      currency: "USD",
      url: link,
      soldAt,
      shipping,
    };

    // Grade + date filters here to reduce junk early
    if (!matchesGrade(title, grade)) return;
    if (!withinRange(sale.soldAt, dateFrom, dateTo)) return;

    // Basic quality checks
    const lower = title.toLowerCase();
    if (
      lower.includes("lot of") ||
      lower.includes("bundle") ||
      lower.includes("proxy") ||
      lower.includes("damaged")
    ) {
      return;
    }

    items.push(sale);
  });

  return dedupeByUrl(items);
}

/* --------------------------------- Handler -------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const { query, dateFrom, dateTo, grade } = await req.json();

    const q = (query || "").toString().trim();
    if (!q) {
      return NextResponse.json({
        worth: { median: null, range: null, count: 0 },
        sales: [],
        timeseries: [],
        citations: [],
        notes:
          "Please enter a specific card (e.g., 'Giratina V 186/196 Lost Origin PSA 10').",
      });
    }

    // 1) Fetch deterministic SOLD comps from eBay
    const sales = await fetchEbaySold(q, dateFrom, dateTo, grade);

    // 2) Short-circuit if not enough comps
    if (sales.length < 3) {
      return NextResponse.json({
        worth: { median: null, range: null, count: sales.length },
        sales,
        timeseries: [],
        citations: Array.from(new Set(sales.map((s) => s.url))).slice(0, 6),
        notes:
          "Not enough trustworthy SOLD comps on eBay. Try adding set & number (e.g., 'Giratina V 186/196'), relaxing grade, or widening the date range.",
      });
    }

    // 3) Estimate median and range using your existing estimator
    const origin = new URL(req.url).origin;
    const est = await fetch(`${origin}/api/estimate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sales }),
    }).then((r) => r.json());

    // 4) Chart data (weekly median)
    const timeseries = groupByWeek(
      sales.map((s) => ({
        soldAt: s.soldAt,
        price: s.price + (s.shipping || 0),
      }))
    );

    // 5) Citations: use the eBay item URLs we actually parsed
    const citations = Array.from(new Set(sales.map((s) => s.url))).slice(0, 6);

    return NextResponse.json({
      worth: {
        median: est.median ?? null,
        range: est.range ?? null,
        count: sales.length,
      },
      sales: sales.slice(0, 50),
      timeseries,
      citations,
      notes: undefined,
    });
  } catch (err) {
    console.error("[agent] unhandled error:", err);
    return NextResponse.json(
      { error: "Agent failed unexpectedly. Check server logs for details." },
      { status: 500 }
    );
  }
}
