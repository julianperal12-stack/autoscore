"use client";

import { useState } from "react";
import {
  parseVehicle,
  runAtlas,
  type AtlasResult,
} from "@/lib/atlas";

export default function Home() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<AtlasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function analyzeText() {
    if (!text.trim()) return;

    setError("");
    const vehicle = parseVehicle(text);
    setResult(runAtlas(vehicle));
  }

  async function analyzeUrl() {
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "No hemos podido leer el anuncio."
        );
      }

      setResult(data.analysis);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No hemos podido leer el anuncio."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
            AutoScore · Analizador de coches
          </div>

          <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">
            Antes de comprar un coche,
            <span className="text-zinc-400"> pásalo por AutoScore.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
            Pega el enlace del anuncio y AutoScore intentará leerlo y
            analizar precio, kilometraje, equipamiento, mantenimiento y
            riesgos.
          </p>
        </div>

        <div className="mt-12 rounded-[32px] border border-white/10 bg-white/[0.04] p-5 md:p-7">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            URL del anuncio
          </label>

          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  analyzeUrl();
                }
              }}
              placeholder="https://..."
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
            />

            <button
              onClick={analyzeUrl}
              disabled={!url.trim() || loading}
              className="rounded-2xl bg-white px-7 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Leyendo anuncio..." : "Analizar anuncio"}
            </button>
          </div>

          <div className="my-7 flex items-center gap-4 text-xs uppercase tracking-[0.18em] text-zinc-600">
            <div className="h-px flex-1 bg-white/10" />
            O PEGA EL TEXTO
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`Volkswagen Golf 2017
185.000 km
12.900 €
Diésel
Manual
190 CV
Cámara trasera
Apple CarPlay`}
            className="min-h-44 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-5 text-base text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
          />

          <button
            onClick={analyzeText}
            disabled={!text.trim()}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 px-6 py-4 font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analizar texto
          </button>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        {result && <Analysis result={result} />}
      </div>
    </main>
  );
}

function Analysis({ result }: { result: AtlasResult }) {
  return (
    <section className="mt-10 space-y-5">
      <div className="rounded-[32px] bg-white p-7 text-black md:p-9">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Veredicto AutoScore
            </p>

            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              {result.recommendation}
            </h2>

            <p className="mt-3 text-zinc-500">
              Confianza del análisis: {result.confidence}%
            </p>
          </div>

          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-zinc-950 text-white">
            <span className="text-4xl font-semibold">
              {result.score}
            </span>
            <span className="text-xs text-zinc-500">/100</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Vehículo
          </p>

          <h3 className="mt-3 text-2xl font-semibold">
            {[result.vehicle.make, result.vehicle.model]
              .filter(Boolean)
              .join(" ") || "Vehículo no identificado"}
          </h3>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Info
              label="Año"
              value={result.vehicle.year?.toString() || "—"}
            />

            <Info
              label="Kilómetros"
              value={
                result.vehicle.mileage
                  ? `${result.vehicle.mileage.toLocaleString(
                      "es-ES"
                    )} km`
                  : "—"
              }
            />

            <Info
              label="Precio"
              value={
                result.vehicle.price
                  ? `${result.vehicle.price.toLocaleString(
                      "es-ES"
                    )} €`
                  : "—"
              }
            />

            <Info
              label="Combustible"
              value={result.vehicle.fuel || "—"}
            />

            <Info
              label="Cambio"
              value={result.vehicle.transmission || "—"}
            />

            <Info
              label="Potencia"
              value={
                result.vehicle.power
                  ? `${result.vehicle.power} CV`
                  : "—"
              }
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            PriceScore
          </p>

          <h3 className="mt-3 text-2xl font-semibold">
            {result.priceAnalysis.verdict}
          </h3>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {result.priceAnalysis.explanation}
          </p>

          <div className="mt-6 text-4xl font-semibold">
            {result.priceAnalysis.score}
            <span className="text-base text-zinc-600">/100</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Mantenimiento estimado
          </p>

          <p className="mt-3 text-3xl font-semibold">
            {result.maintenance.min.toLocaleString("es-ES")}–
            {result.maintenance.max.toLocaleString("es-ES")} €
            <span className="text-sm font-normal text-zinc-500">
              {" "}
              / año
            </span>
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Extras detectados
          </p>

          {result.vehicle.extras.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.vehicle.extras.map((extra) => (
                <span
                  key={extra}
                  className="rounded-full bg-white/10 px-3 py-2 text-sm text-zinc-300"
                >
                  {extra}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">
              No se han detectado extras.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Puntos a vigilar
        </p>

        <div className="mt-5 space-y-3">
          {result.commonIssues.map((issue) => (
            <div
              key={issue}
              className="rounded-2xl bg-orange-400/10 px-4 py-3 text-sm text-orange-200"
            >
              ⚠ {issue}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-medium text-zinc-200">{value}</p>
    </div>
  );
}
