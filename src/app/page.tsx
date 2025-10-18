"use client";

import { useState } from "react";

type TavilyResult = { title: string; url: string; content?: string };

const MAX_RESULTS = 15;
const EXAMPLE_QUERIES = [
  "Giratina V 186/196 PSA 10",
  "LeBron James Topps Chrome #111 BGS 9.5",
  "Charizard UPC promo PSA 9",
  "Shohei Ohtani Bowman Chrome auto /50",
];

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

  async function handleSearch(searchTerm?: string) {
    const raw = searchTerm ?? query;
    const q = raw.trim();
    if (!q) return;

    if (searchTerm !== undefined) {
      setQuery(searchTerm);
    }

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
        body: JSON.stringify({ query: q, maxResults: MAX_RESULTS }),
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

      const incoming = (data?.results as TavilyResult[]) ?? [];
      setResults(incoming.slice(0, MAX_RESULTS));
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
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#d9efff,_#fef6ff)] py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="blur-3xl absolute -top-24 -left-10 h-72 w-72 rounded-full bg-sky-200/50" />
        <div className="blur-3xl absolute top-40 right-0 h-80 w-80 rounded-full bg-rose-200/60" />
        <div className="blur-3xl absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-200/40" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col gap-10 px-6">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/80 p-10 shadow-xl backdrop-blur-md transition duration-500 hover:shadow-2xl">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/40 via-transparent to-white/30" />
          <header className="relative z-10 flex flex-col gap-4 text-center md:text-left">
            <span className="mx-auto md:mx-0 inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
              Card Scout
            </span>
            <h1 className="text-3xl font-semibold text-slate-800 sm:text-4xl">
              Dial in real-time trading card comps in seconds
            </h1>
            <p className="text-sm text-slate-500 sm:text-base">
              We search trusted marketplaces like eBay, TCGPlayer, and CardMarket.
              Keep it card-focused with grading, set numbers, or parallels for the best matches.
            </p>
          </header>

          <div className="relative z-10 mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-sky-100 bg-white/90 p-4 shadow-inner shadow-sky-100/40 transition duration-300 hover:border-sky-200 hover:shadow-lg sm:flex-row sm:items-center">
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Search cards
                </label>
                <input
                  type="text"
                  placeholder="2022 Giratina V 186/196 Lost Origin PSA 10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <button
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 via-sky-400 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-300/40 transition hover:scale-[1.01] hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                onClick={() => void handleSearch()}
                disabled={loading}
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Try:
              </span>
              {EXAMPLE_QUERIES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void handleSearch(example)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-500 transition hover:-translate-y-[1px] hover:border-sky-300 hover:text-sky-600 hover:shadow-sm"
                >
                  {example}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-600 shadow-sm">
                {error}
              </div>
            )}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/30 via-transparent to-white/20" />
          <div className="relative z-10 flex flex-col gap-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  Latest market pulls
                </h2>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Showing up to {MAX_RESULTS} results
                </p>
              </div>
              {loading && (
                <div className="flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-600 shadow-sm">
                  <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
                  Fetching comps…
                </div>
              )}
            </header>

            <div className="grid gap-4">
              {loading ? (
                <div className="grid gap-3">
                  {[...Array(3)].map((_, idx) => (
                    <div
                      key={idx}
                      className="h-20 animate-pulse rounded-3xl border border-slate-100 bg-slate-50/80"
                    />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center text-sm text-slate-400">
                  Ready when you are—enter a card query to explore price comps.
                </div>
              ) : (
                results.map((r, idx) => (
                  <article
                    key={`${r.url ?? "result"}-${idx}`}
                    className="group rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm transition duration-300 hover:-translate-y-[2px] hover:border-sky-200 hover:shadow-lg"
                  >
                    <div className="flex flex-col gap-2">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lg font-semibold text-sky-600 transition group-hover:text-indigo-500"
                      >
                        {r.title || r.url}
                      </a>
                      {r.content && (
                        <p className="text-sm text-slate-500">
                          {r.content}
                        </p>
                      )}
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {r.url}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
