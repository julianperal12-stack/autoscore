import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";
import { parseVehicle, runAtlas } from "@/lib/atlas";
import { parseCochesNet } from "@/lib/sources/cochesNet";

export const runtime = "nodejs";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80:")
  );
}

async function assertSafeUrl(input: string): Promise<URL> {
  const url = new URL(input);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http o https.");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("Esta URL no está permitida.");
  }

  const addresses = await dns.lookup(hostname, {
    all: true,
    verbatim: true,
  });

  for (const address of addresses) {
    if (
      net.isIP(address.address) === 4 &&
      isPrivateIPv4(address.address)
    ) {
      throw new Error("Esta URL no está permitida.");
    }

    if (
      net.isIP(address.address) === 6 &&
      isPrivateIPv6(address.address)
    ) {
      throw new Error("Esta URL no está permitida.");
    }
  }

  return url;
}

async function readLimitedBody(
  response: Response,
  maxBytes = 1_500_000
): Promise<string> {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel();
      break;
    }

    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode();

  return result;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input =
      typeof body?.url === "string" ? body.url.trim() : "";

    if (!input) {
      return NextResponse.json(
        { error: "Introduce una URL." },
        { status: 400 }
      );
    }

    const url = await assertSafeUrl(input);

    let html = "";
    let source = "direct";

    /*
     * Primero intentamos acceder directamente.
     * Algunos portales, como Coches.net, pueden devolver 405/403.
     */
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        12000
      );

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          },
          cache: "no-store",
        });

        if (response.ok) {
          const contentType =
            response.headers.get("content-type") || "";

          if (
            contentType.includes("text/html") ||
            contentType.includes("application/xhtml+xml") ||
            contentType.includes("application/json")
          ) {
            html = await readLimitedBody(response);
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Continuamos con el fallback.
    }

    /*
     * Fallback: Jina Reader.
     *
     * Su servicio Reader convierte una URL en contenido textual
     * incluso cuando el servidor de AutoScore no puede acceder
     * directamente al portal.
     */
    if (!html || html.length < 80) {
      const readerUrl =
        "https://r.jina.ai/" + url.toString();

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        20000
      );

      try {
        const readerResponse = await fetch(readerUrl, {
          signal: controller.signal,
          headers: {
            Accept: "text/plain",
            "User-Agent": "AutoScore/1.0",
          },
          cache: "no-store",
        });

        if (!readerResponse.ok) {
          return NextResponse.json(
            {
              error:
                `No hemos podido leer el anuncio ` +
                `(lector externo: ${readerResponse.status}).`,
            },
            { status: 502 }
          );
        }

        html = await readerResponse.text();
        source = "jina-reader";
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!html || html.length < 80) {
      return NextResponse.json(
        {
          error:
            "No hemos podido leer suficiente información del anuncio.",
        },
        { status: 422 }
      );
    }

    const text = htmlToText(html);

    if (text.length < 80) {
      return NextResponse.json(
        {
          error:
            "No hemos podido extraer suficiente información del anuncio.",
        },
        { status: 422 }
      );
    }

    const isCochesNet =
      url.hostname.toLowerCase().includes("coches.net");

    let vehicle;

    if (isCochesNet) {
      const sourceData = parseCochesNet(html);

      const genericData = parseVehicle(text);

      vehicle = {
        ...genericData,
        make: sourceData.make ?? genericData.make,
        year: sourceData.year ?? genericData.year,
        mileage:
          sourceData.mileage ?? genericData.mileage,
        price: sourceData.price ?? genericData.price,
        power: sourceData.power ?? genericData.power,
        fuel: sourceData.fuel ?? genericData.fuel,
        transmission:
          sourceData.transmission ??
          genericData.transmission,
        extras:
          sourceData.extras.length > 0
            ? sourceData.extras
            : genericData.extras,
      };
    } else {
      vehicle = parseVehicle(text);
    }

    const analysis = runAtlas(vehicle);

    return NextResponse.json({
      url: url.toString(),
      source,
      analysis,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No hemos podido leer el anuncio.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}

