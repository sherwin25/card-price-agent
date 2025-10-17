import { NextRequest, NextResponse } from "next/server";

type ResolveBody = { query: string };

export async function POST(req: NextRequest) {
  const { query } = (await req.json()) as ResolveBody;
  return NextResponse.json({
    cardId: "mock-123",
    name: query,
    set: "Mock Set",
    number: "#4",
    printing: "holo",
    image: "",
  });
}
