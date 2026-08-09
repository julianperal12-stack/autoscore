import {
  calculateComparableSimilarity,
  calculateMarketStats,
  rankComparableVehicles,
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

  estimatedPrice: number | null;
  estimatedMin: number | null;
  estimatedMax: number | null;

  differencePercent: number | null;
  confidence: number;
};

type VehicleForMarket = {
  make?: string;
  model?: string;
  version?: string;
  year?: number;
  mileage?: number;
  price?: number;
  power?: number;
  fuel?: string;
  transmission?: string;
  drivetrain?: string;
  body?: string;
};

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Precio estimado ponderado.
 *
 * Los comparables prácticamente idénticos pesan mucho más
 * que los secundarios.
 */
function calculateWeightedPrice(
  matches: ReturnType<typeof rankComparableVehicles>
) {
  const usable = matches.filter(
    (match) => match.similarity >= 60
  );

  if (usable.length === 0) {
    return null;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const match of usable) {
    const price =
      match.observation.askingPrice ??
      match.observation.price;

    if (!Number.isFinite(price)) {
      continue;
    }

    /*
     * Peso no lineal:
     *
     * 100 similitud → peso 1.00
     * 90            → 0.81
     * 80            → 0.64
     * 70            → 0.49
     * 60            → 0.36
     */
    const normalized =
      match.similarity / 100;

    const weight =
      normalized * normalized;

    weightedSum += price * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  return Math.round(
    weightedSum / totalWeight
  );
}

function calculateMarketConfidence(
  matches: ReturnType<typeof rankComparableVehicles>
) {
  const strong = matches.filter(
    (match) => match.similarity >= 85
  ).length;

  const close = matches.filter(
    (match) => match.similarity >= 60
  ).length;

  if (strong >= 5) {
    return 95;
  }

  if (strong >= 3) {
    return 90;
  }

  if (strong >= 1 && close >= 5) {
    return 82;
  }

  if (close >= 5) {
    return 75;
  }

  if (close >= 3) {
    return 65;
  }

  return 40;
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
      estimatedPrice: null,
      estimatedMin: null,
      estimatedMax: null,
      differencePercent: null,
      confidence: 0,
    };
  }

  const matches =
    rankComparableVehicles(
      vehicle,
      observations
    );

  const strongMatches =
    matches.filter(
      (match) => match.similarity >= 60
    );

  if (strongMatches.length < 3) {
    const stats =
      calculateMarketStats(
        strongMatches.map(
          (match) => match.observation
        )
      );

    return {
      score: null,
      verdict: "Sin datos suficientes",
      explanation:
        `Solo hemos encontrado ${strongMatches.length} comparables suficientemente similares. Necesitamos al menos 3 para emitir una valoración de mercado fiable.`,
      comparableCount: strongMatches.length,
      marketMin: stats?.min ?? null,
      marketMax: stats?.max ?? null,
      marketMedian: stats?.median ?? null,
      estimatedPrice: null,
      estimatedMin: null,
      estimatedMax: null,
      differencePercent: null,
      confidence:
        strongMatches.length === 2
          ? 45
          : strongMatches.length === 1
            ? 25
            : 0,
    };
  }

  const observationsForStats =
    strongMatches.map(
      (match) => match.observation
    );

  const stats =
    calculateMarketStats(
      observationsForStats
    );

  if (!stats) {
    return {
      score: null,
      verdict: "Sin datos suficientes",
      explanation:
        "No hemos podido calcular estadísticas válidas del mercado.",
      comparableCount: 0,
      marketMin: null,
      marketMax: null,
      marketMedian: null,
      estimatedPrice: null,
      estimatedMin: null,
      estimatedMax: null,
      differencePercent: null,
      confidence: 0,
    };
  }

  const estimatedPrice =
    calculateWeightedPrice(matches);

  if (!estimatedPrice) {
    return {
      score: null,
      verdict: "Sin datos suficientes",
      explanation:
        "No hemos podido calcular un precio estimado fiable.",
      comparableCount: strongMatches.length,
      marketMin: stats.min,
      marketMax: stats.max,
      marketMedian: stats.median,
      estimatedPrice: null,
      estimatedMin: null,
      estimatedMax: null,
      differencePercent: null,
      confidence: 0,
    };
  }

  const differencePercent =
    ((vehicle.price - estimatedPrice) /
      estimatedPrice) *
    100;

  /*
   * PriceScore:
   *
   * precio de mercado       → 50
   * 10% por debajo          → 70
   * 20% por debajo          → 90
   * 25%+ por debajo         → 100
   *
   * precio 10% por encima   → 30
   * precio 20% por encima   → 10
   */
  const score = clamp(
    Math.round(
      50 - differencePercent * 2
    ),
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

  const confidence =
    calculateMarketConfidence(matches);

  /*
   * Rango orientativo alrededor del precio estimado.
   * Más comparables → rango más estrecho.
   */
  const rangePercent =
    confidence >= 90
      ? 0.06
      : confidence >= 80
        ? 0.08
        : confidence >= 70
          ? 0.10
          : 0.13;

  const estimatedMin =
    Math.round(
      estimatedPrice *
        (1 - rangePercent)
    );

  const estimatedMax =
    Math.round(
      estimatedPrice *
        (1 + rangePercent)
    );

  const explanation =
    `El anuncio está ${direction} del precio estimado de ` +
    `${estimatedPrice.toLocaleString("es-ES")} €. ` +
    `La valoración utiliza ${strongMatches.length} comparables ` +
    `ponderados por similitud.`;

  return {
    score,
    verdict,
    explanation,
    comparableCount: strongMatches.length,
    marketMin: stats.min,
    marketMax: stats.max,
    marketMedian: stats.median,
    estimatedPrice,
    estimatedMin,
    estimatedMax,
    differencePercent,
    confidence,
  };
}
