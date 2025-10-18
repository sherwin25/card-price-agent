"use client";

import { useState } from "react";

type TavilyResult = { title: string; url: string; content?: string };

function looksLikeCardQueryClient(q: string): boolean {
  const s = q.toLowerCase();
  const mustInclude = [
    "psa",
    "bgs",
    "cgc",
    "tcgplayer",
    "cardmarket",
    "ebay",
    "rc",
    "rookie",
    "holo",
    "hollow",
    "refractor",
    "parallel",
    "auto",
    "patch",
    "alt art",
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
  const numberLike = /(^|\s)(\d{1,3}\/\d{1,3}|#?\d{1,4})(\s|$)/;
  const hasToken = mustInclude.some((t) => s.includes(t));
  const hasNumber = numberLike.test(s);
  return hasToken || hasNumber;
}

export default function Home() {
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<TavilyResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;

    // Client-side guard for fast feedback (API also validates)
    if (!looksLikeCardQueryClient(q)) {
      setError(
        "This tool only searches trading cards. Try something like “Giratina V 186/196 PSA 10” or “Ohtani Topps Chrome #150 PSA 9”."
      );
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : `Search failed (${res.status})`
        );
        setResults([]);
        return;
      }

      setResults((data?.results as TavilyResult[]) ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void handleSearch();
  }

  return (
    <main className="max-w-2xl mx-auto p-6 text-center space-y-6">
      <h1 className="text-2xl font-semibold">Card Price Search</h1>
      <p className="text-sm opacity-80">
        Search is restricted to trading cards (Pokémon, MTG, sports). Example:{" "}
        <span className="italic">Giratina V 186/196 PSA 10</span>.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="e.g. 2022 Giratina V 186/196 Lost Origin PSA 10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 border rounded p-2"
        />
        <button
          className="bg-black text-white rounded px-4"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <section className="text-left space-y-3 border rounded p-4">
        {loading ? (
          <p className="opacity-70">Searching…</p>
        ) : results.length === 0 ? (
          <p className="opacity-70 text-sm">No results yet.</p>
        ) : (
          results.map((r) => (
            <div key={r.url} className="border-b pb-2">
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 underline"
              >
                {r.title || r.url}
              </a>
              {r.content && (
                <p className="text-sm opacity-80 mt-1">{r.content}</p>
              )}
              <p className="text-xs opacity-60 mt-1">{r.url}</p>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
