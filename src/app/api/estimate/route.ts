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

export async function POST(req: NextRequest) {
  const { sales } = await req.json();
  const cleaned = (sales || [])
    .filter((s: any) => s && s.price > 0 && s.price < 1e6)
    .map((s: any) => s.price + (s.shipping || 0));

  if (cleaned.length < 3)
    return NextResponse.json({
      message: "Not enough comps",
      median: null,
      range: null,
    });

  const { median, p20, p80 } = trimmedStats(cleaned, 0.1);
  return NextResponse.json({ median, range: [p20, p80] });
}
