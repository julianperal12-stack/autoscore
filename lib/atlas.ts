export type VehicleData = {
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  fuel?: string;
  transmission?: string;
  power?: number;
  extras: string[];
  rawText: string;
};

export type AtlasResult = {
  score: number;
  recommendation: string;
  confidence: number;
  vehicle: VehicleData;
  priceAnalysis: {
    score: number;
    verdict: string;
    explanation: string;
  };
  maintenance: {
    min: number;
    max: number;
  };
  commonIssues: string[];
  strengths: string[];
  weaknesses: string[];
};

const BRANDS = [
  "Audi",
  "BMW",
  "Mercedes",
  "Mercedes-Benz",
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
  "Citroen",
  "Citroën",
  "Cupra",
  "Dacia",
  "Jeep",
  "Fiat",
  "Mini",
];

const EXTRA_KEYWORDS: Record<string, string> = {
  "techo panorámico": "Techo panorámico",
  "techo panoramico": "Techo panorámico",
  "techo solar": "Techo solar",
  "cámara 360": "Cámara 360º",
  "camara 360": "Cámara 360º",
  "cámara trasera": "Cámara trasera",
  "camara trasera": "Cámara trasera",
  "head-up display": "Head-Up Display",
  "head up display": "Head-Up Display",
  "hud": "Head-Up Display",
  "cuero": "Tapicería de cuero",
  "piel": "Tapicería de cuero",
  "burmester": "Burmester",
  "bowers & wilkins": "Bowers & Wilkins",
  "harman kardon": "Harman Kardon",
  "bang & olufsen": "Bang & Olufsen",
  "apple carplay": "Apple CarPlay",
  "android auto": "Android Auto",
  "asientos eléctricos": "Asientos eléctricos",
  "asientos electricos": "Asientos eléctricos",
  "asientos calefactados": "Asientos calefactados",
  "asientos ventilados": "Asientos ventilados",
  "multibeam": "Multibeam LED",
  "matrix led": "Matrix LED",
  "faros matrix": "Matrix LED",
  "control de crucero adaptativo": "Control de crucero adaptativo",
  "crucero adaptativo": "Control de crucero adaptativo",
  "amg line": "Paquete AMG Line",
  "m sport": "Paquete M Sport",
  "s line": "Paquete S line",
  "virtual cockpit": "Virtual Cockpit",
};

function normalizeNumber(value: string): number | undefined {
  const cleaned = value.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : undefined;
}

function extractBrand(text: string): string | undefined {
  const lower = text.toLowerCase();

  return BRANDS.find((brand) =>
    lower.includes(brand.toLowerCase())
  );
}

function extractYear(text: string): number | undefined {
  const currentYear = new Date().getFullYear();

  const matches = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)];

  const years = matches
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1990 && year <= currentYear);

  return years.length > 0 ? years[0] : undefined;
}

function extractMileage(text: string): number | undefined {
  const normalized = text
    .replace(String.fromCharCode(160), " ")
    .replace(String.fromCharCode(13), " ");

  const lower = normalized.toLowerCase();
  const positions: number[] = [];

  let position = lower.indexOf("km");

  while (position !== -1) {
    positions.push(position);
    position = lower.indexOf("km", position + 2);
  }

  for (const kmPosition of positions) {
    const before = normalized.slice(0, kmPosition).trimEnd();

    let end = before.length;
    let start = end;

    while (start > 0) {
      const char = before[start - 1];

      if (
        (char >= "0" && char <= "9") ||
        char === "." ||
        char === " "
      ) {
        start--;
      } else {
        break;
      }
    }

    const raw = before.slice(start, end).trim();

    if (!raw) {
      continue;
    }

    const digits = raw.replaceAll(".", "").replaceAll(" ", "");
    const value = Number(digits);

    if (Number.isInteger(value) && value >= 500 && value <= 500000) {
      return value;
    }
  }

  return undefined;
}

function extractPrice(text: string): number | undefined {
  const normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");

  const labelledPatterns = [
    /precio\s+(?:al\s+contado|de\s+venta|final|anunciado)\s*:?\s*(?:EUR\s*)?([\d.]{4,8})\s*€/i,
    /precio\s*:?\s*(?:EUR\s*)?([\d.]{4,8})\s*€/i,
    /precio\s+(?:al\s+contado|de\s+venta|final|anunciado)\s*:?\s*(?:€\s*)?([\d.]{4,8})/i,
  ];

  for (const pattern of labelledPatterns) {
    const match = normalized.match(pattern);

    if (!match) continue;

    const value = normalizeNumber(match[1]);

    if (value !== undefined && value >= 3000 && value <= 1000000) {
      return value;
    }
  }

  const euroPattern =
    /(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\s*€/i;

  const euroMatch = normalized.match(euroPattern);

  if (euroMatch) {
    const value = normalizeNumber(euroMatch[1]);

    if (value !== undefined && value >= 3000 && value <= 1000000) {
      return value;
    }
  }

  return undefined;
}

function extractFuel(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (
    lower.includes("híbrido enchufable") ||
    lower.includes("hibrido enchufable") ||
    lower.includes("plug-in")
  ) {
    return "Híbrido enchufable";
  }

  if (lower.includes("híbrido") || lower.includes("hibrido")) {
    return "Híbrido";
  }

  if (
    lower.includes("eléctrico") ||
    lower.includes("electrico") ||
    lower.includes("electric")
  ) {
    return "Eléctrico";
  }

  if (lower.includes("diésel") || lower.includes("diesel")) {
    return "Diésel";
  }

  if (lower.includes("gasolina") || lower.includes("petrol")) {
    return "Gasolina";
  }

  return undefined;
}

function extractTransmission(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (
    lower.includes("automático") ||
    lower.includes("automatic") ||
    lower.includes("dsg") ||
    lower.includes("steptronic") ||
    lower.includes("7g-dct")
  ) {
    return "Automático";
  }

  if (lower.includes("manual")) {
    return "Manual";
  }

  return undefined;
}

function extractPower(text: string): number | undefined {
  const normalized = text
    .replace(String.fromCharCode(160), " ")
    .replace(String.fromCharCode(13), " ");

  const lower = normalized.toLowerCase();

  const units = ["cv", "hp"];

  for (const unit of units) {
    let position = lower.indexOf(unit);

    while (position !== -1) {
      const before = normalized.slice(0, position).trimEnd();

      let end = before.length;
      let start = end;

      while (start > 0) {
        const char = before[start - 1];

        if (char >= "0" && char <= "9") {
          start--;
        } else {
          break;
        }
      }

      const raw = before.slice(start, end);

      if (raw) {
        const value = Number(raw);

        if (Number.isInteger(value) && value >= 50 && value <= 1000) {
          return value;
        }
      }

      position = lower.indexOf(unit, position + unit.length);
    }
  }

  return undefined;
}

function extractModel(
  text: string,
  make?: string
): string | undefined {
  if (!make) return undefined;

  const lower = text.toLowerCase();

  const models = [
    "Golf",
    "Corolla",
    "320d",
    "Serie 3",
    "Clase C",
    "GLC",
    "Q5",
    "Q3",
    "A3",
    "A4",
    "A5",
    "Tiguan",
    "T-Roc",
    "Passat",
    "Polo",
    "Leon",
    "León",
    "Ibiza",
    "Ateca",
    "C-HR",
    "Yaris",
    "RAV4",
    "Clio",
    "Captur",
    "Megane",
    "308",
    "3008",
    "Model 3",
    "Model Y",
  ];

  return models.find((model) =>
    lower.includes(model.toLowerCase())
  );
}

function extractExtras(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const [keyword, label] of Object.entries(EXTRA_KEYWORDS)) {
    if (lower.includes(keyword) && !found.includes(label)) {
      found.push(label);
    }
  }

  return found;
}

export function parseVehicle(text: string): VehicleData {
  const make = extractBrand(text);

  return {
    make,
    model: extractModel(text, make),
    year: extractYear(text),
    mileage: extractMileage(text),
    price: extractPrice(text),
    fuel: extractFuel(text),
    transmission: extractTransmission(text),
    power: extractPower(text),
    extras: extractExtras(text),
    rawText: text,
  };
}

function calculatePriceScore(vehicle: VehicleData) {
  if (!vehicle.price) {
    return {
      score: 50,
      verdict: "PRECIO DESCONOCIDO",
      explanation:
        "No hemos podido identificar el precio.",
    };
  }

  if (vehicle.price < 10000) {
    return {
      score: 75,
      verdict: "PRECIO ATRACTIVO",
      explanation:
        "El precio de entrada es relativamente bajo. Necesitamos comparables para afinar la valoración.",
    };
  }

  if (vehicle.price < 20000) {
    return {
      score: 72,
      verdict: "PRECIO RAZONABLE",
      explanation:
        "El precio parece razonable, aunque necesitamos referencias de mercado para afinarlo.",
    };
  }

  return {
    score: 70,
    verdict: "PRECIO POR ANALIZAR",
    explanation:
      "Necesitamos referencias de mercado para valorar este precio con precisión.",
  };
}

function getMaintenance(vehicle: VehicleData) {
  const make = vehicle.make?.toLowerCase();

  if (make === "toyota") {
    return { min: 450, max: 850 };
  }

  if (make === "volkswagen") {
    return { min: 600, max: 1100 };
  }

  if (
    make === "bmw" ||
    make === "mercedes" ||
    make === "audi"
  ) {
    return { min: 750, max: 1400 };
  }

  return { min: 500, max: 1000 };
}

function getCommonIssues(vehicle: VehicleData): string[] {
  const make = vehicle.make?.toLowerCase();
  const model = vehicle.model?.toLowerCase();

  if (make === "toyota") {
    return [
      "Comprobar historial de mantenimiento",
      "Revisar batería y sistema híbrido si corresponde",
    ];
  }

  if (model === "golf") {
    return [
      "Comprobar historial de mantenimiento",
      "Revisar embrague y caja de cambios",
      "Comprobar consumo de aceite",
    ];
  }

  if (make === "bmw") {
    return [
      "Comprobar historial de mantenimiento",
      "Revisar sistema de refrigeración",
      "Comprobar fugas y estado del motor",
    ];
  }

  if (make === "mercedes") {
    return [
      "Comprobar historial de mantenimiento",
      "Revisar transmisión automática",
      "Comprobar electrónica y sistemas de asistencia",
    ];
  }

  return [
    "Comprobar historial de mantenimiento",
    "Realizar inspección mecánica antes de comprar",
  ];
}

function calculateConfidence(vehicle: VehicleData): number {
  const fields = [
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.mileage,
    vehicle.price,
    vehicle.fuel,
    vehicle.transmission,
  ];

  const detected = fields.filter(
    (field) => field !== undefined
  ).length;

  return Math.round((detected / fields.length) * 100);
}

export function runAtlas(vehicle: VehicleData): AtlasResult {
  let score = 70;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (vehicle.mileage !== undefined) {
    if (vehicle.mileage < 60000) {
      score += 8;
      strengths.push("Kilometraje bajo");
    } else if (vehicle.mileage < 120000) {
      score += 3;
    } else if (vehicle.mileage > 180000) {
      score -= 10;
      weaknesses.push("Kilometraje elevado");
    }
  }

  if (vehicle.year !== undefined) {
    const age = new Date().getFullYear() - vehicle.year;

    if (age <= 3) {
      score += 5;
      strengths.push("Vehículo relativamente reciente");
    } else if (age > 12) {
      score -= 5;
      weaknesses.push("Vehículo con cierta antigüedad");
    }
  }

  if (
    vehicle.fuel === "Híbrido" ||
    vehicle.fuel === "Híbrido enchufable" ||
    vehicle.fuel === "Eléctrico"
  ) {
    score += 3;
  }

  if (vehicle.extras.length >= 3) {
    score += 3;
    strengths.push("Buen nivel de equipamiento");
  }

  const priceAnalysis = calculatePriceScore(vehicle);

  if (priceAnalysis.score >= 85) {
    score += 8;
    strengths.push("Precio especialmente interesante");
  } else if (priceAnalysis.score < 60) {
    score -= 8;
    weaknesses.push("Precio poco atractivo");
  }

  score = Math.max(0, Math.min(100, score));

  let recommendation = "LA NEGOCIARÍA";

  if (score >= 82) {
    recommendation = "LA COMPRARÍA";
  } else if (score < 60) {
    recommendation = "NO LA COMPRARÍA";
  }

  return {
    score,
    recommendation,
    confidence: calculateConfidence(vehicle),
    vehicle,
    priceAnalysis,
    maintenance: getMaintenance(vehicle),
    commonIssues: getCommonIssues(vehicle),
    strengths,
    weaknesses,
  };
}
