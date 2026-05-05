// Rate limit em memoria (token bucket por chave). Single-process.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

let limparAgendado = false;
function agendarLimpeza() {
  if (limparAgendado) return;
  limparAgendado = true;
  setInterval(() => {
    const agora = Date.now();
    for (const [k, b] of buckets) if (b.resetAt < agora) buckets.delete(k);
  }, 10 * 60 * 1000).unref?.();
}

export function rateLimit(chave: string, limite: number, janelaMs: number): {
  ok: boolean; restantes: number; resetEmMs: number;
} {
  agendarLimpeza();
  const agora = Date.now();
  let b = buckets.get(chave);
  if (!b || b.resetAt < agora) {
    b = { count: 0, resetAt: agora + janelaMs };
    buckets.set(chave, b);
  }
  b.count += 1;
  const restantes = Math.max(0, limite - b.count);
  return { ok: b.count <= limite, restantes, resetEmMs: b.resetAt - agora };
}

export function ipDe(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || "0.0.0.0";
}
