// Geocoding free via Nominatim OpenStreetMap.
// Limite: 1 req/s (politica deles). Cache em memoria evita repetir.
// Em prod, considerar self-hosted Nominatim ou API paga (Google).

type LatLon = { lat: number; lon: number; municipio?: string; uf?: string };

const cache = new Map<string, LatLon | null>();

const USER_AGENT = "SevenConstruction/1.0 (contato@sevenconstruction.com.br)";

let ultimaChamada = 0;
const MIN_GAP_MS = 1100;

async function rateLimitDelay() {
  const agora = Date.now();
  const espera = Math.max(0, ultimaChamada + MIN_GAP_MS - agora);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaChamada = Date.now();
}

/**
 * CEP → lat/lon. Free via Nominatim.
 * Retorna null se nao encontrado.
 */
export async function cepParaLatLon(cep: string): Promise<LatLon | null> {
  const limpo = cep.replace(/\D/g, "");
  if (limpo.length !== 8) return null;

  const chave = `cep:${limpo}`;
  if (cache.has(chave)) return cache.get(chave) ?? null;

  await rateLimitDelay();
  try {
    const formatado = `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${formatado}&country=Brasil&format=json&limit=1&addressdetails=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      cache.set(chave, null);
      return null;
    }
    const data = (await r.json()) as Array<{
      lat: string;
      lon: string;
      address?: { city?: string; town?: string; state_code?: string; state?: string };
    }>;
    if (!data || data.length === 0) {
      cache.set(chave, null);
      return null;
    }
    const item = data[0];
    const result: LatLon = {
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      municipio: item.address?.city || item.address?.town,
      uf: item.address?.state_code,
    };
    cache.set(chave, result);
    return result;
  } catch (e) {
    console.warn("[geo] cep->latlon falhou:", e instanceof Error ? e.message : e);
    cache.set(chave, null);
    return null;
  }
}

/**
 * Distância em km entre 2 coords (Haversine).
 */
export function distanciaKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Filtra empresas por raio (precisa lat/lon — RFB não tem por padrão,
 * então este filtro só funciona se já houver coords cadastradas).
 * Pra busca por CEP loja + raio, fazer geocode loja + filter cidade
 * com fallback (sem RFB lat/lon, raio é aproximado pela cidade).
 */
export function dentroDoRaio(
  origem: LatLon,
  destino: LatLon,
  raio_km: number,
): boolean {
  return distanciaKm(origem, destino) <= raio_km;
}
