import { readFile, appendFile } from "node:fs/promises";
import path from "node:path";

type MarketImport = {
  make: string;
  model: string;
  version?: string;
  trim?: string;
  year: number;
  mileage: number;
  power?: number;
  engine?: string;
  fuel?: string;
  transmission?: string;
  drivetrain?: string;
  body?: string;
  askingPrice: number;
  cashPrice?: number;
  financePrice?: number;
  extras?: string[];
  sellerType?: "professional" | "private";
  sellerName?: string;
  region?: string;
  source: string;
  sourceUrl: string;
  publishedAt?: string;
  observedAt?: string;
  rawText?: string;
};

const MARKET_FILE = path.join(
  process.cwd(),
  "lib",
  "data",
  "market-observations.jsonl"
);

function clean(value?: string): string {
  return typeof value === "string" ? value.trim() : "";
}

function validate(item: MarketImport): string[] {
  const errors: string[] = [];

  if (!clean(item.make)) errors.push("make");
  if (!clean(item.model)) errors.push("model");

  if (
    !Number.isInteger(item.year) ||
    item.year < 1990 ||
    item.year > new Date().getFullYear() + 1
  ) {
    errors.push("year");
  }

  if (
    !Number.isFinite(item.mileage) ||
    item.mileage < 500 ||
    item.mileage > 500000
  ) {
    errors.push("mileage");
  }

  if (
    !Number.isFinite(item.askingPrice) ||
    item.askingPrice < 1000 ||
    item.askingPrice > 1000000
  ) {
    errors.push("askingPrice");
  }

  if (!clean(item.source)) errors.push("source");
  if (!clean(item.sourceUrl)) errors.push("sourceUrl");

  return errors;
}

async function main() {
  const inputFile = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");

  if (!inputFile) {
    console.error(
      "Uso: npx tsx scripts/import-market.ts archivo.json [--dry-run]"
    );
    process.exit(1);
  }

  const input = JSON.parse(
    await readFile(path.resolve(inputFile), "utf8")
  ) as MarketImport[];

  if (!Array.isArray(input)) {
    throw new Error("El fichero debe contener un array JSON.");
  }

  let existing = "";

  try {
    existing = await readFile(MARKET_FILE, "utf8");
  } catch {
    // La base todavía puede no existir.
  }

  const existingUrls = new Set<string>();

  for (const line of existing.split("\n")) {
    if (!line.trim()) continue;

    try {
      const observation = JSON.parse(line);
      if (observation.sourceUrl) {
        existingUrls.add(observation.sourceUrl);
      }
    } catch {
      // Ignoramos líneas corruptas existentes.
    }
  }

  const validItems: object[] = [];
  const rejected: string[] = [];
  let duplicates = 0;

  for (const item of input) {
    const errors = validate(item);

    if (errors.length > 0) {
      rejected.push(
        `${item.make || "?"} ${item.model || "?"}: ${errors.join(", ")}`
      );
      continue;
    }

    const sourceUrl = clean(item.sourceUrl);

    if (existingUrls.has(sourceUrl)) {
      duplicates++;
      continue;
    }

    const observation = {
      id: `obs_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,

      make: clean(item.make),
      model: clean(item.model),
      version: clean(item.version) || undefined,
      trim: clean(item.trim) || undefined,

      year: item.year,
      mileage: item.mileage,
      power: item.power,
      engine: clean(item.engine) || undefined,
      fuel: clean(item.fuel) || undefined,
      transmission: clean(item.transmission) || undefined,
      drivetrain: clean(item.drivetrain) || undefined,
      body: clean(item.body) || undefined,

      askingPrice: item.askingPrice,
      cashPrice: item.cashPrice,
      financePrice: item.financePrice,

      extras: item.extras ?? [],

      sellerType: item.sellerType,
      sellerName: clean(item.sellerName) || undefined,
      region: clean(item.region) || undefined,

      source: clean(item.source),
      sourceUrl,

      publishedAt: clean(item.publishedAt) || undefined,
      observedAt:
        item.observedAt || new Date().toISOString(),

      rawText: clean(item.rawText) || undefined,
    };

    validItems.push(observation);
    existingUrls.add(sourceUrl);
  }

  if (validItems.length > 0 && !dryRun) {
    await appendFile(
      MARKET_FILE,
      validItems.map((item) => JSON.stringify(item)).join("\n") + "\n",
      "utf8"
    );
  }

  console.log("");
  console.log("===== IMPORTACIÓN MARKET =====");
  console.log(`Recibidos: ${input.length}`);
  console.log(`Guardados: ${validItems.length}`);
  console.log(`Duplicados: ${duplicates}`);
  console.log(`Rechazados: ${rejected.length}`);

  if (dryRun) {
    console.log("");
    console.log("DRY RUN → NO SE HA MODIFICADO LA BASE");
  }

  if (rejected.length > 0) {
    console.log("");
    console.log("===== RECHAZADOS =====");

    for (const error of rejected) {
      console.log(`- ${error}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
