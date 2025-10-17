"use client";
import { useState } from "react";

type Sale = {
  source: "ebay" | "tcgplayer" | "cardmarket" | "stockx" | "scrape";
  title: string;
  price: number;
  currency: string;
  url: string;
  soldAt: string;
  shipping?: number;
};

type ResolveResp = {
  cardId: string;
  name: string;
  set: string;
  number: string;
  printing: string;
  image: string;
};

type EstimateResp = {
  median: number | null;
  range: [number, number] | null;
  message?: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [grade, setGrade] = useState("");
  const [result, setResult] = useState<{
    card: ResolveResp;
    est: EstimateResp;
    samples: Sale[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setResult(null);
    try {
      const card: ResolveResp = await fetch("/api/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      }).then((r) => r.json());

      const [ebay, tcg, cm]: [
        { sales: Sale[] },
        { sales: Sale[] },
        { sales: Sale[] }
      ] = await Promise.all([
        fetch("/api/prices/ebay", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cardId: card.cardId,
            dateFrom,
            dateTo,
            grade,
          }),
        }).then((r) => r.json()),
        fetch("/api/prices/tcgplayer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cardId: card.cardId,
            dateFrom,
            dateTo,
            grade,
          }),
        }).then((r) => r.json()),
        fetch("/api/prices/cardmarket", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cardId: card.cardId,
            dateFrom,
            dateTo,
            grade,
          }),
        }).then((r) => r.json()),
      ]);

      const sales: Sale[] = [
        ...(ebay.sales ?? []),
        ...(tcg.sales ?? []),
        ...(cm.sales ?? []),
      ];

      const est: EstimateResp = await fetch("/api/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sales }),
      }).then((r) => r.json());

      setResult({ card, est, samples: sales.slice(0, 6) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6 grid md:grid-cols-2 gap-6">
      {/* left pane: form */}
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Card Price Agent</h1>
        <p className="text-sm opacity-80">
          Estimate today’s value from recent SOLD comps with sources.
        </p>

        <label className="block text-sm">Card search</label>
        <input
          className="w-full border rounded p-2"
          placeholder="1999 Pokémon Base Set Charizard #4 Holo, PSA 8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm">From</label>
            <input
              type="date"
              className="w-full border rounded p-2"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm">To</label>
            <input
              type="date"
              className="w-full border rounded p-2"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <label className="block text-sm">Grade (optional)</label>
        <input
          className="w-full border rounded p-2"
          placeholder="PSA 8, PSA 9, CGC 9, or 'raw'"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        />

        <button
          className="rounded bg-black text-white px-4 py-2"
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? "Working..." : "Get Value"}
        </button>
      </section>

      {/* right pane: results */}
      <section className="border rounded p-3 space-y-3">
        {!result ? (
          <div className="opacity-70 text-sm">Results will appear here.</div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Today’s worth</h2>
            {result.est.median !== null && result.est.range ? (
              <div>
                ${result.est.median} (20–80%: ${result.est.range[0]} – $
                {result.est.range[1]})
              </div>
            ) : (
              <div>Not enough comps.</div>
            )}

            <h3 className="font-medium mt-4">Sample comps</h3>
            <ul className="list-disc pl-5 text-sm">
              {result.samples.map((s: Sale, i: number) => (
                <li key={i}>
                  <a className="underline" href={s.url} target="_blank">
                    {s.title}
                  </a>{" "}
                  — ${s.price}
                  {s.shipping ? ` + ${s.shipping} ship` : ``}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
