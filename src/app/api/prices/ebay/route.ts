import { NextRequest, NextResponse } from "next/server";

type Sale = {
  source: "ebay";
  title: string;
  price: number;
  currency: string;
  url: string;
  soldAt: string;
  shipping?: number;
};

export async function POST(req: NextRequest) {
  const { dateFrom, dateTo } = (await req.json()) as {
    dateFrom?: string;
    dateTo?: string;
  };

  const sales: Sale[] = [
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
