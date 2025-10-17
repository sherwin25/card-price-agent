import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  // TODO: call Scryfall / Pokémon TCG APIs; for now return a mock
  return NextResponse.json({
    cardId: "mock-123",
    name: query,
    set: "Mock Set",
    number: "#4",
    printing: "holo",
    image: "",
  });
}
