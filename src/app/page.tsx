"use client";

import { useState } from "react";

type Result = { title: string; url: string; content?: string };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [strict, setStrict] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    setLoading(true);
    setError(null);
    setResults([]);

    // optional domain whitelist (helps for card-price stuff)
    const includeDomains = strict
      ? [
          "ebay.com",
          "tcgplayer.com",
          "cardmarket.com",
          "pwccmarketplace.com",
          "goldinauctions.com",
          "ha.com",
        ]
      : [];

    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, maxResults: 10, includeDomains }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Search failed");
      setResults(data.results || []);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runSearch();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Web Search</h1>
      <p className="text-sm opacity-80 mb-4">
        Type anything and I’ll search the web for you (Tavily).
      </p>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded p-2"
          placeholder='e.g., "Giratina V 186/196 Lost Origin PSA 10 recent sold"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="rounded bg-black text-white px-4 py-2"
          onClick={runSearch}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={strict}
          onChange={(e) => setStrict(e.target.checked)}
        />
        Prefer trusted domains (eBay, TCGplayer, Cardmarket, PWCC, Goldin,
        Heritage)
      </label>

      {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}

      <ul className="mt-6 space-y-4">
        {results.map((r, i) => (
          <li key={i} className="border rounded p-3">
            <a
              className="font-medium underline"
              href={r.url}
              target="_blank"
              rel="noreferrer"
            >
              {r.title || r.url}
            </a>
            {r.content && (
              <p className="text-sm mt-1 opacity-80">{r.content}</p>
            )}
            <p className="text-xs opacity-60 mt-1">{r.url}</p>
          </li>
        ))}
        {!loading && results.length === 0 && !error && (
          <li className="text-sm opacity-70">
            No results yet — try a search above.
          </li>
        )}
      </ul>
    </main>
  );
}
