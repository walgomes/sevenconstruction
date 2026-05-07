// Geocoding em cascata:
// 1) BrasilAPI v2 — gratuito, mas nem todo CEP retorna coords (depende do provider escolhido)
// 2) Fallback Nominatim (OpenStreetMap) — gratuito, requer User-Agent identificavel
//    e respeita 1 req/s (controlado por gateNominatim).
//
// Cache em memoria evita re-consultar o mesmo CEP. Pra batch grande,
// salvar lat/lng na tabela ja serve de cache persistente.

const UA = "SevenConstruction/1.0 (walbericogomes@gmail.com)";
const cacheMemoria = new Map<string, Coords | null>();

export type Coords = { lat: number; lng: number };

export async function geocodificarCep(cep: string): Promise<Coords | null> {
  const limpo = cep.replace(/\D+/g, "");
  if (limpo.length !== 8) return null;

  if (cacheMemoria.has(limpo)) return cacheMemoria.get(limpo) ?? null;

  // 1) BrasilAPI v2
  const v1 = await tentarBrasilApi(limpo);
  if (v1) { cacheMemoria.set(limpo, v1); return v1; }

  // 2) Fallback Nominatim (rate-limit 1/s)
  const v2 = await tentarNominatim(limpo);
  cacheMemoria.set(limpo, v2);
  return v2;
}

async function tentarBrasilApi(cep: string): Promise<Coords | null> {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
    };
    const lat = parseFloat(String(j.location?.coordinates?.latitude ?? ""));
    const lng = parseFloat(String(j.location?.coordinates?.longitude ?? ""));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;
    return { lat, lng };
  } catch { return null; }
}

// Nominatim exige <=1 req/s — gate global em memoria do processo.
let nominatimUltimoMs = 0;
async function gateNominatim(): Promise<void> {
  const desde = Date.now() - nominatimUltimoMs;
  if (desde < 1100) await new Promise((r) => setTimeout(r, 1100 - desde));
  nominatimUltimoMs = Date.now();
}

async function tentarNominatim(cep: string): Promise<Coords | null> {
  await gateNominatim();
  const cepFmt = `${cep.slice(0, 5)}-${cep.slice(5)}`;
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${cepFmt}&country=Brazil&format=json&limit=1`;
    const r = await fetch(url, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const arr = (await r.json()) as { lat?: string; lon?: string }[];
    const hit = arr[0];
    const lat = parseFloat(hit?.lat ?? "");
    const lng = parseFloat(hit?.lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch { return null; }
}

// Distancia em km via Haversine. Boa aproximacao pra distancias <1000km.
const RAIO_TERRA_KM = 6371;

export function distanciaKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

function toRad(graus: number): number {
  return (graus * Math.PI) / 180;
}

// Helper de bounding box pra prefiltrar via SQL antes de Haversine real.
// Util pra "todos parceiros num raio de 50km".
export function boundingBox(centro: Coords, raioKm: number): {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
} {
  const dLat = raioKm / 111; // 1 grau lat ~ 111km
  const dLng = raioKm / (111 * Math.cos(toRad(centro.lat)));
  return {
    minLat: centro.lat - dLat,
    maxLat: centro.lat + dLat,
    minLng: centro.lng - dLng,
    maxLng: centro.lng + dLng,
  };
}
