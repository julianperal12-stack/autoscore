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

  year: number;
  mileage: number;

  fuel?: FuelType;
  transmission?: TransmissionType;
  power?: number;

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
