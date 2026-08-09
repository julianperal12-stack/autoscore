import {
  calculateMarketStats,
  findComparableVehicles,
  type MarketObservation,
} from "@/lib/data/market";

export type MarketScoreResult = {
  score: number | null;
  verdict: string;
  explanation: string;
  comparableCount: number;
  marketMin: number | null;
  marketMax: number | null;
  marketMedian: number | null;
  differencePercent: number | null;
};

type VehicleForMarket = {
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  fuel?: string;
  transmission?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function calculateMarketPriceScore(
  vehicle: VehicleForMarket,
  observations: MarketObservation[]
): MarketScoreResult {
  if (
    !vehicle.make ||
    !vehicle.model ||
    !vehicle.year ||
    !vehicle.mileage ||
    !vehicle.price
  ) {
    return {
      score: null,
      verdict: "Datos insuficientes",
      explanation:
        "Necesitamos marca, modelo, año, kilometraje y precio para comparar el vehículo con el mercado.",
      comparableCount: 0,
      marketMin: null,
      marketMax: null,
      marketMedian: null,
      differencePercent: null,
    };
  }

  const comparables = findComparableVehicles(
    vehicle,
    observations
  );

  const stats = calculateMarketStats(comparables);

  if (!stats || stats.count < 3) {
    return {
      score: null,
      verdict: "Sin datos suficientes",
      explanation:
        `Solo hemos encontrado ${stats?.count ?? 0} vehículos comparables. Necesitamos al menos 3 para emitir un PriceScore de mercado fiable.`,
      comparableCount: stats?.count ?? 0,
      marketMin: stats?.min ?? null,
      marketMax: stats?.max ?? null,
      marketMedian: stats?.median ?? null,
      differencePercent: null,
    };
  }

  const differencePercent =
    ((vehicle.price - stats.median) / stats.median) * 100;

  /*
   * Interpretación:
   *
   * - Precio igual a mercado → 50
   * - 10% por debajo → ~70
   * - 20% por debajo → ~90
   * - 30%+ por debajo → 100
   *
   * Por encima del mercado:
   * - 10% más caro → ~30
   * - 20% más caro → ~10
   * - 30%+ más caro → 0
   */
  const score = clamp(
    Math.round(50 - differencePercent * 2),
    0,
    100
  );

  let verdict: string;

  if (score >= 85) {
    verdict = "Excelente precio";
  } else if (score >= 70) {
    verdict = "Buen precio";
  } else if (score >= 55) {
    verdict = "Precio competitivo";
  } else if (score >= 45) {
    verdict = "Precio de mercado";
  } else if (score >= 30) {
    verdict = "Algo caro";
  } else {
    verdict = "Caro";
  }

  const direction =
    differencePercent < 0
      ? `${Math.abs(differencePercent).toFixed(1)}% por debajo`
      : differencePercent > 0
        ? `${differencePercent.toFixed(1)}% por encima`
        : "prácticamente en línea";

  const explanation =
    `El anuncio está ${direction} de la mediana ` +
    `de ${stats.median.toLocaleString("es-ES")} € ` +
    `en ${stats.count} comparables.`;

  return {
    score,
    verdict,
    explanation,
    comparableCount: stats.count,
    marketMin: stats.min,
    marketMax: stats.max,
    marketMedian: stats.median,
    differencePercent,
  };
}
