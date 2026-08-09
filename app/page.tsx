"use client";

import { useState } from "react";
import {
  parseVehicle,
  runAtlas,
  type AtlasResult,
} from "@/lib/atlas";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AtlasResult | null>(null);

  function analyze() {
    if (!text.trim()) return;

    const vehicle = parseVehicle(text);
    const analysis = runAtlas(vehicle);

    setResult(analysis);
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
            Pega el anuncio del coche y obtén una valoración rápida de su
            precio, kilometraje, equipamiento, mantenimiento y riesgos.
          </p>
        </div>

        <div className="mt-12 rounded-[32px] border border-white/10 bg-white/[0.04] p-5 md:p-7">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`Pega aquí el anuncio o sus datos...

Ejemplo:
Volkswagen Golf 2017
185.000 km
12.900 €
Diésel
Manual
Cámara trasera
Apple CarPlay`}
            className="min-h-56 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-5 text-base text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
          />

          <button
            onClick={analyze}
            disabled={!text.trim()}
            className="mt-4 w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analizar coche
          </button>
        </div>

        {result && (
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
                        ? `${result.vehicle.mileage.toLocaleString("es-ES")} km`
                        : "—"
                    }
                  />
                  <Info
                    label="Precio"
                    value={
                      result.vehicle.price
                        ? `${result.vehicle.price.toLocaleString("es-ES")} €`
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
                  Mantenimiento
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {result.maintenance.min.toLocaleString("es-ES")}–
                  {result.maintenance.max.toLocaleString("es-ES")} €
                  <span className="text-sm font-normal text-zinc-500">
                    {" "} / año
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
        )}
      </div>
    </main>
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
