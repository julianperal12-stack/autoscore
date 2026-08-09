/**
 * AutoScore - Market Database V1
 *
 * Esta primera versión almacena observaciones de mercado individuales.
 * NO guardamos un único "precio medio" por modelo:
 * el valor depende de año, kilometraje, motor, combustible y cambio.
 */

export type FuelType =
  | "Gasolina"
  | "Diésel"
  | "Híbrido"
  | "Híbrido enchufable"
  | "Eléctrico"
  | "Otro";

export type TransmissionType =
  | "Manual"
  | "Automático"
  | "Otro";

export type MarketObservation = {
  id: string;

  make: string;
  model: string;

  version?: string;
  trim?: string;
  engine?: string;

  year: number;
  mileage: number;

  power?: number;
  fuel?: FuelType;
  transmission?: TransmissionType;
  drivetrain?: string;
  body?: string;

  price: number;

  /**
   * Precio por el que se anuncia el vehículo.
   * Más adelante podremos guardar también precio de venta
   * cuando dispongamos de datos reales.
   */
  askingPrice: number;

  country: string;
  region?: string;

  /**
   * Fuente del dato.
   */
  source:
    | "coches.net"
    | "autoscout24"
    | "mobile.de"
    | "wallapop"
    | "other";

  sourceUrl?: string;

  /**
   * Fecha en la que observamos el anuncio.
   */
  observedAt: string;
};

/**
 * V1 empieza deliberadamente vacía.
 *
 * Los primeros datos se introducirán a partir de anuncios reales.
 * No queremos contaminar PriceScore con precios inventados.
 */
export const MARKET_OBSERVATIONS: MarketObservation[] = [];

/**
 * Normalización básica para comparar nombres procedentes
 * de diferentes portales.
 */
export function normalizeMarketText(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca observaciones comparables.
 *
 * V1:
 * - misma marca
 * - mismo modelo
 * - año +/- 2 años
 * - kilometraje +/- 35%
 * - mismo combustible si ambos están disponibles
 * - misma transmisión si ambas están disponibles
 */
export function findComparableVehicles(
  vehicle: {
    make?: string;
    model?: string;
    version?: string;
    year?: number;
    mileage?: number;
    fuel?: string;
    transmission?: string;
    power?: number;
  },
  observations = MARKET_OBSERVATIONS
): MarketObservation[] {
  if (
    !vehicle.make ||
    !vehicle.model ||
    !vehicle.year ||
    !vehicle.mileage
  ) {
    return [];
  }

  const make = normalizeMarketText(vehicle.make);
  const model = normalizeMarketText(vehicle.model);

  return observations.filter((observation) => {
    if (normalizeMarketText(observation.make) !== make) {
      return false;
    }

    if (normalizeMarketText(observation.model) !== model) {
      return false;
    }

    if (Math.abs(observation.year - vehicle.year!) > 2) {
      return false;
    }

    const mileageDifference =
      Math.abs(observation.mileage - vehicle.mileage!) /
      Math.max(vehicle.mileage!, 1);

    if (mileageDifference > 0.35) {
      return false;
    }

    if (
      vehicle.fuel &&
      observation.fuel &&
      normalizeMarketText(vehicle.fuel) !==
        normalizeMarketText(observation.fuel)
    ) {
      return false;
    }

    if (
      vehicle.transmission &&
      observation.transmission &&
      normalizeMarketText(vehicle.transmission) !==
        normalizeMarketText(observation.transmission)
    ) {
      return false;
    }

    /*
     * La potencia permite distinguir versiones/motores.
     *
     * Ejemplo:
     * X3 20 xDrive 208 CV vs X3 20d 197 CV
     * → 5,3% de diferencia → comparable.
     *
     * X3 20 xDrive 208 CV vs X3 30e 292 CV
     * → demasiada diferencia → no comparable principal.
     *
     * Si alguno de los dos anuncios no tiene potencia,
     * no descartamos el comparable para no perder datos.
     */
    if (
      vehicle.power &&
      observation.power
    ) {
      const powerDifference =
        Math.abs(observation.power - vehicle.power) /
        Math.max(vehicle.power, 1);

      if (powerDifference > 0.15) {
        return false;
      }
    }

    return true;
  });
}

export type ComparableTier =
  | "exact"
  | "close"
  | "secondary";

export type ComparableMatch = {
  observation: MarketObservation;
  similarity: number;
  tier: ComparableTier;
  reasons: string[];
};

function percentageDifference(
  a: number,
  b: number
): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), 1);
}

/**
 * Calcula una similitud 0-100 entre el vehículo analizado
 * y un anuncio del mercado.
 *
 * No decide todavía si el anuncio entra o no en PriceScore.
 * Solo mide qué tan parecido es.
 */
export function calculateComparableSimilarity(
  vehicle: {
    make?: string;
    model?: string;
    version?: string;
    year?: number;
    mileage?: number;
    power?: number;
    fuel?: string;
    transmission?: string;
    drivetrain?: string;
    body?: string;
  },
  observation: MarketObservation
): ComparableMatch {
  let score = 100;
  const reasons: string[] = [];

  // Marca/modelo son requisitos estructurales.
  if (
    normalizeMarketText(vehicle.make) !==
    normalizeMarketText(observation.make)
  ) {
    return {
      observation,
      similarity: 0,
      tier: "secondary",
      reasons: ["Marca diferente"],
    };
  }

  if (
    normalizeMarketText(vehicle.model) !==
    normalizeMarketText(observation.model)
  ) {
    return {
      observation,
      similarity: 0,
      tier: "secondary",
      reasons: ["Modelo diferente"],
    };
  }

  // Año
  if (vehicle.year) {
    const yearDifference = Math.abs(
      observation.year - vehicle.year
    );

    if (yearDifference === 0) {
      reasons.push("Mismo año");
    } else if (yearDifference === 1) {
      score -= 8;
      reasons.push("Año ±1");
    } else if (yearDifference === 2) {
      score -= 18;
      reasons.push("Año ±2");
    } else {
      score -= 35;
      reasons.push("Año más alejado");
    }
  }

  // Kilometraje
  if (vehicle.mileage) {
    const mileageDifference =
      percentageDifference(
        observation.mileage,
        vehicle.mileage
      );

    if (mileageDifference <= 0.10) {
      reasons.push("Kilometraje muy similar");
    } else if (mileageDifference <= 0.20) {
      score -= 3;
      reasons.push("Kilometraje similar");
    } else if (mileageDifference <= 0.35) {
      score -= 7;
      reasons.push("Kilometraje algo diferente");
    } else {
      score -= 15;
      reasons.push("Kilometraje bastante diferente");
    }
  }

  // Potencia
  if (vehicle.power && observation.power) {
    const powerDifference =
      percentageDifference(
        observation.power,
        vehicle.power
      );

    if (powerDifference <= 0.05) {
      reasons.push("Potencia prácticamente idéntica");
    } else if (powerDifference <= 0.10) {
      score -= 5;
      reasons.push("Potencia muy similar");
    } else if (powerDifference <= 0.15) {
      score -= 12;
      reasons.push("Potencia similar");
    } else {
      score -= 35;
      reasons.push("Potencia diferente");
    }
  }

  // Versión/motor
  if (vehicle.version && observation.version) {
    const vehicleVersion =
      normalizeMarketText(vehicle.version);

    const observationVersion =
      normalizeMarketText(observation.version);

    if (vehicleVersion === observationVersion) {
      reasons.push("Misma versión");
    } else {
      score -= 25;
      reasons.push("Versión diferente");
    }
  }

  // Combustible
  if (vehicle.fuel && observation.fuel) {
    if (
      normalizeMarketText(vehicle.fuel) ===
      normalizeMarketText(observation.fuel)
    ) {
      reasons.push("Mismo combustible");
    } else {
      score -= 30;
      reasons.push("Combustible diferente");
    }
  }

  // Cambio
  if (vehicle.transmission && observation.transmission) {
    if (
      normalizeMarketText(vehicle.transmission) ===
      normalizeMarketText(observation.transmission)
    ) {
      reasons.push("Mismo cambio");
    } else {
      score -= 20;
      reasons.push("Cambio diferente");
    }
  }

  // Tracción
  if (vehicle.drivetrain && observation.drivetrain) {
    if (
      normalizeMarketText(vehicle.drivetrain) ===
      normalizeMarketText(observation.drivetrain)
    ) {
      reasons.push("Misma tracción");
    } else {
      score -= 10;
      reasons.push("Tracción diferente");
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let tier: ComparableTier;

  if (score >= 85) {
    tier = "exact";
  } else if (score >= 60) {
    tier = "close";
  } else {
    tier = "secondary";
  }

  return {
    observation,
    similarity: score,
    tier,
    reasons,
  };
}

/**
 * Devuelve comparables ordenados por similitud.
 */
export function rankComparableVehicles(
  vehicle: {
    make?: string;
    model?: string;
    version?: string;
    year?: number;
    mileage?: number;
    power?: number;
    fuel?: string;
    transmission?: string;
    drivetrain?: string;
    body?: string;
  },
  observations: MarketObservation[]
): ComparableMatch[] {
  return observations
    .filter(
      (observation) =>
        normalizeMarketText(observation.make) ===
          normalizeMarketText(vehicle.make) &&
        normalizeMarketText(observation.model) ===
          normalizeMarketText(vehicle.model)
    )
    .map((observation) =>
      calculateComparableSimilarity(
        vehicle,
        observation
      )
    )
    .sort(
      (a, b) =>
        b.similarity - a.similarity
    );
}

/**
 * Calcula estadísticas sencillas sobre comparables.
 */
export function calculateMarketStats(
  observations: MarketObservation[]
) {
  if (observations.length === 0) {
    return null;
  }

  const prices = observations
    .map((observation) => observation.price)
    .filter((price) => Number.isFinite(price));

  if (prices.length === 0) {
    return null;
  }

  const sorted = [...prices].sort((a, b) => a - b);

  const sum = prices.reduce(
    (total, price) => total + price,
    0
  );

  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] +
          sorted[sorted.length / 2]) /
        2
      : sorted[Math.floor(sorted.length / 2)];

  return {
    count: prices.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average: Math.round(sum / prices.length),
    median: Math.round(median),
  };
}
