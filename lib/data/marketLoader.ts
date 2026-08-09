import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MarketObservation } from "@/lib/data/market";

export async function loadMarketObservations(): Promise<MarketObservation[]> {
  const filePath = path.join(
    process.cwd(),
    "lib",
    "data",
    "market-observations.jsonl"
  );

  try {
    const content = await readFile(filePath, "utf8");

    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MarketObservation);
  } catch {
    return [];
  }
}
