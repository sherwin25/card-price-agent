"use client";
import { useState } from "react";
import PriceChart from "@/components/PriceChart";

type AgentResult = {
  worth: {
    median: number | null;
    range: [number, number] | null;
    count: number;
  };
  sales: Array<{
    title: string;
    url: string;
    price: number;
    shipping?: number;
    soldAt: string;
  }>;
  timeseries: Array<{ week: string; median: number; n: number }>;
  citations: string[];
  notes?: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [grade, setGrade] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function askAgent() {
    setLoading(true);
    setResult(null);
    try {
      const res: AgentResult = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, dateFrom, dateTo, grade }),
      }).then((r) => r.json());
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6 grid md:grid-cols-2 gap-6">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Card Price Agent</h1>
        <p className="text-sm opacity-80">
          Ask about any card’s value; the agent searches public sold comps and
          charts history.
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
          placeholder="PSA 9, CGC 9, or 'raw'"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        />

        <button
          className="rounded bg-black text-white px-4 py-2"
          onClick={askAgent}
          disabled={loading}
        >
          {loading ? "Working..." : "Ask Agent"}
        </button>
      </section>

      <section className="border rounded p-3 space-y-3">
        {!result ? (
          <div className="opacity-70 text-sm">Results will appear here.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-lg">
              {result.worth.median !== null && result.worth.range ? (
                <>
                  Today’s Worth: <b>${result.worth.median}</b> (20–80%: $
                  {result.worth.range[0]} – ${result.worth.range[1]})
                </>
              ) : (
                <>Not enough comps.</>
              )}
              <div className="text-sm opacity-70">
                Comps used: {result.worth.count}
              </div>
            </div>

            <PriceChart data={result.timeseries} />

            <h3 className="font-medium">Recent comps</h3>
            <ul className="list-disc pl-5 text-sm">
              {result.sales.slice(0, 8).map((s, i) => (
                <li key={i}>
                  <a className="underline" href={s.url} target="_blank">
                    {s.title}
                  </a>{" "}
                  — ${s.price}
                  {s.shipping ? ` + ${s.shipping} ship` : ``} (
                  {s.soldAt?.slice(0, 10)})
                </li>
              ))}
            </ul>

            {result.citations?.length ? (
              <>
                <h4 className="font-medium mt-2">Sources</h4>
                <ul className="list-disc pl-5 text-sm">
                  {result.citations.map((u) => (
                    <li key={u}>
                      <a className="underline" href={u} target="_blank">
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {result.notes && (
              <p className="text-xs opacity-70">{result.notes}</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
