import { NextResponse } from "next/server";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type ObservationInput = {
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  fuel?: string;
  transmission?: string;
  power?: number;
  source?: string;
  sourceUrl?: string;
  region?: string;
};

function cleanString(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as ObservationInput;

    const make = cleanString(body.make);
    const model = cleanString(body.model);
    const source = cleanString(body.source);
    const sourceUrl = cleanString(body.sourceUrl);

    if (
      !make ||
      !model ||
      !body.year ||
      !body.mileage ||
      !body.price ||
      !source ||
      !sourceUrl
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan datos obligatorios para guardar el comparable.",
        },
        { status: 400 }
      );
    }

    if (
      body.year < 1990 ||
      body.year > new Date().getFullYear() + 1
    ) {
      return NextResponse.json(
        { error: "Año no válido." },
        { status: 400 }
      );
    }

    if (body.mileage < 500 || body.mileage > 500000) {
      return NextResponse.json(
        { error: "Kilometraje no válido." },
        { status: 400 }
      );
    }

    if (body.price < 1000 || body.price > 1000000) {
      return NextResponse.json(
        { error: "Precio no válido." },
        { status: 400 }
      );
    }

    const observation = {
      id: `obs_${Date.now()}`,
      make,
      model,
      year: body.year,
      mileage: body.mileage,
      fuel: body.fuel || undefined,
      transmission: body.transmission || undefined,
      power: body.power || undefined,
      price: body.price,
      askingPrice: body.price,
      country: "España",
      region: body.region || undefined,
      source,
      sourceUrl,
      observedAt: new Date().toISOString(),
    };

    const filePath = path.join(
      process.cwd(),
      "lib",
      "data",
      "market-observations.jsonl"
    );

    const line =
      JSON.stringify(observation) + "\n";

    /*
     * Evitamos guardar dos veces exactamente la misma URL.
     */
    try {
      const existing = await readFile(
        filePath,
        "utf8"
      );

      if (existing.includes(`"sourceUrl":"${sourceUrl}"`)) {
        return NextResponse.json({
          saved: false,
          duplicate: true,
          message:
            "Este anuncio ya está en la base de mercado.",
        });
      }
    } catch {
      // El fichero todavía no existe.
    }

    await appendFile(filePath, line, "utf8");

    return NextResponse.json({
      saved: true,
      observation,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "No hemos podido guardar la observación.",
      },
      { status: 500 }
    );
  }
}
