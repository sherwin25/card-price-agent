import { NextRequest, NextResponse } from "next/server";

function trimmedStats(nums: number[], trim = 0.1) {
  const s = nums.slice().sort((a, b) => a - b);
  const k = Math.floor(s.length * trim);
  const core = s.slice(k, s.length - k);
  const mid = Math.floor(core.length / 2);
  const median = core.length ? core[mid] : null;
  const p20 = s[Math.floor(0.2 * (s.length - 1))];
  const p80 = s[Math.floor(0.8 * (s.length - 1))];
  return { median, p20, p80 };
}

type Sale = { price: number; shipping?: number };

export async function POST(req: NextRequest) {
  const { sales } = (await req.json()) as { sales: Sale[] };
  const cleanedTotals: number[] = (sales ?? [])
    .filter((s) => s && s.price > 0 && s.price < 1_000_000)
    .map((s) => s.price + (s.shipping ?? 0));

  if (cleanedTotals.length < 3) {
    return NextResponse.json({
      message: "Not enough comps",
      median: null,
      range: null as [number, number] | null,
    });
  }

  const { median, p20, p80 } = trimmedStats(cleanedTotals, 0.1);
  return NextResponse.json({ median, range: [p20, p80] as [number, number] });
}
