export type CochesNetData = {
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  power?: number;
  fuel?: string;
  transmission?: string;
  extras: string[];
};

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberFromText(value: string): number | undefined {
  const digits = value.replace(/[^\d]/g, "");

  if (!digits) return undefined;

  return Number(digits);
}

function extractNumberBefore(
  text: string,
  unit: string
): number | undefined {
  const lower = text.toLowerCase();
  const position = lower.indexOf(unit.toLowerCase());

  if (position === -1) return undefined;

  const before = text.slice(0, position);

  const matches = before.match(/[\d. ]+/g);

  if (!matches || matches.length === 0) {
    return undefined;
  }

  const raw = matches[matches.length - 1];

  const value = numberFromText(raw);

  return value;
}

function extractYear(text: string): number | undefined {
  const matches = text.match(/\b20\d{2}\b/g);

  if (!matches) return undefined;

  const currentYear = new Date().getFullYear();

  const years = matches
    .map(Number)
    .filter((year) => year >= 1990 && year <= currentYear + 1);

  return years[0];
}

function extractMileage(text: string): number | undefined {
  const patterns = [
    /([\d. ]+)\s*km\b/i,
    /([\d. ]+)\s*kilómetros?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    const value = numberFromText(match[1]);

    if (
      value !== undefined &&
      value >= 500 &&
      value <= 500000
    ) {
      return value;
    }
  }

  return undefined;
}

function extractPrice(text: string): number | undefined {
  const patterns = [
    /([\d. ]+)\s*€/i,
    /precio[^0-9]*([\d. ]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    const value = numberFromText(match[1]);

    if (
      value !== undefined &&
      value >= 3000 &&
      value <= 1000000
    ) {
      return value;
    }
  }

  return undefined;
}

function extractPower(text: string): number | undefined {
  const patterns = [
    /(\d{2,3})\s*CV\b/i,
    /(\d{2,3})\s*HP\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    const value = Number(match[1]);

    if (value >= 50 && value <= 1000) {
      return value;
    }
  }

  return undefined;
}

function extractFuel(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (
    lower.includes("híbrido enchufable") ||
    lower.includes("hibrido enchufable")
  ) {
    return "Híbrido enchufable";
  }

  if (
    lower.includes("eléctrico") ||
    lower.includes("electrico")
  ) {
    return "Eléctrico";
  }

  if (
    lower.includes("híbrido") ||
    lower.includes("hibrido")
  ) {
    return "Híbrido";
  }

  if (
    lower.includes("diésel") ||
    lower.includes("diesel")
  ) {
    return "Diésel";
  }

  if (lower.includes("gasolina")) {
    return "Gasolina";
  }

  return undefined;
}

function extractTransmission(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (
    lower.includes("automático") ||
    lower.includes("automatic") ||
    lower.includes("dsg")
  ) {
    return "Automático";
  }

  if (lower.includes("manual")) {
    return "Manual";
  }

  return undefined;
}

function extractMake(text: string): string | undefined {
  const brands = [
    "Audi",
    "BMW",
    "Mercedes-Benz",
    "Mercedes",
    "Volkswagen",
    "Toyota",
    "Honda",
    "Ford",
    "Peugeot",
    "Renault",
    "SEAT",
    "Skoda",
    "Hyundai",
    "Kia",
    "Volvo",
    "Mazda",
    "Nissan",
    "Tesla",
    "Lexus",
    "Porsche",
    "Opel",
    "Citroën",
    "Citroen",
    "Cupra",
    "Dacia",
    "Jeep",
    "Fiat",
    "Mini",
  ];

  const lower = text.toLowerCase();

  return brands.find((brand) =>
    lower.includes(brand.toLowerCase())
  );
}

export function parseCochesNet(
  htmlOrText: string
): CochesNetData {
  const text = cleanText(
    htmlOrText
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );

  const make = extractMake(text);

  return {
    title: text.slice(0, 200),
    make,
    year: extractYear(text),
    mileage: extractMileage(text),
    price: extractPrice(text),
    power: extractPower(text),
    fuel: extractFuel(text),
    transmission: extractTransmission(text),
    extras: [],
  };
}
