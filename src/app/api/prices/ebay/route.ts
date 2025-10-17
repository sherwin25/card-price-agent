import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const { dateFrom, dateTo } = await req.json();
  // TODO: eBay Browse/Buy API; mock a few SOLD comps in the date window
  const sales = [
    {
      source: "ebay",
      title: "PSA 8 Charizard",
      price: 880,
      currency: "USD",
      url: "https://example.com/a",
      soldAt: dateTo || "2025-09-20",
    },
    {
      source: "ebay",
      title: "PSA 8 Charizard",
      price: 920,
      currency: "USD",
      url: "https://example.com/b",
      soldAt: dateFrom || "2025-09-10",
    },
    {
      source: "ebay",
      title: "PSA 8 Charizard",
      price: 899,
      currency: "USD",
      url: "https://example.com/c",
      soldAt: "2025-08-28",
    },
  ];
  return NextResponse.json({ sales });
}
