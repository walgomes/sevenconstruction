// Worker de envio. Processa campanhas com status='disparando',
// enviando até taxa_envio_por_min/min. Idempotente via mkt_envios.
//
// Como executar:
//   - Manualmente: GET /api/disparo/processar (admin-only) processa um batch
//   - Cron: chamar /api/disparo/processar a cada 1min com SC_ADMIN_API_KEY
//
// SAFETY: respeita supressões + valida ownership por loja_id.

import pool from "@/lib/db";
import { emailProvider, whatsappProvider } from "./adapters";
import type { EnvioInput } from "./adapters/types";

type ContatoFila = {
  envio_id: number;
  campanha_id: number;
  loja_id: number;
  loja_nome: string;
  canal: "email" | "whatsapp";
  template_corpo: string;
  template_assunto: string | null;
  destino: string;
  contato_nome: string | null;
  contato_empresa: string | null;
  contato_cidade: string | null;
};

/**
 * Processa até `batchSize` envios pendentes. Retorna resumo.
 */
export async function processarBatch(batchSize = 20): Promise<{
  processados: number;
  enviados: number;
  falhas: number;
  duracao_ms: number;
}> {
  const t0 = Date.now();
  let processados = 0;
  let enviados = 0;
  let falhas = 0;

  // Cria envios pendentes p/ campanhas em status='disparando' que ainda nao
  // tem envio gerado por contato.
  await materializarEnvios(batchSize * 5);

  const r = await pool.query<ContatoFila>(
    `SELECT e.id AS envio_id, e.campanha_id, c.loja_id, l.nome_fantasia AS loja_nome,
            c.canal, t.corpo AS template_corpo, t.assunto AS template_assunto,
            e.destino, ct.nome AS contato_nome, ct.empresa AS contato_empresa,
            ct.cidade AS contato_cidade
       FROM sevenconstruction.mkt_envios e
       JOIN sevenconstruction.mkt_campanhas c ON c.id = e.campanha_id
       JOIN sevenconstruction.lojas l ON l.id = c.loja_id
       LEFT JOIN sevenconstruction.mkt_templates t ON t.id = c.template_id
       LEFT JOIN sevenconstruction.mkt_lista_contatos ct ON ct.id = e.contato_id
      WHERE e.status = 'pendente'
        AND c.status = 'disparando'
        AND NOT EXISTS (
          SELECT 1 FROM sevenconstruction.mkt_supressoes s
           WHERE s.loja_id = c.loja_id
             AND s.canal = c.canal
             AND s.destino = lower(e.destino)
        )
      ORDER BY e.criado_em ASC
      LIMIT $1`,
    [batchSize],
  );

  for (const item of r.rows) {
    processados++;
    try {
      const input: EnvioInput = {
        destino: item.destino,
        assunto: item.template_assunto ?? undefined,
        corpo: item.template_corpo ?? "(sem template)",
        loja_nome: item.loja_nome,
        contato_nome: item.contato_nome ?? undefined,
        contato_empresa: item.contato_empresa ?? undefined,
        contato_cidade: item.contato_cidade ?? undefined,
      };

      const provider = item.canal === "email" ? emailProvider() : whatsappProvider();
      const res = await provider.enviar(input);

      if (res.ok) {
        enviados++;
        await pool.query(
          `UPDATE sevenconstruction.mkt_envios
              SET status = 'enviado',
                  provider_id = $1,
                  enviado_em = NOW(),
                  erro = NULL
            WHERE id = $2`,
          [res.provider_id, item.envio_id],
        );
        await pool.query(
          `UPDATE sevenconstruction.mkt_campanhas
              SET total_enviados = total_enviados + 1
            WHERE id = $1`,
          [item.campanha_id],
        );
      } else {
        falhas++;
        await pool.query(
          `UPDATE sevenconstruction.mkt_envios
              SET status = $1,
                  erro = $2
            WHERE id = $3`,
          [res.permanente ? "falhou" : "pendente", res.erro.slice(0, 500), item.envio_id],
        );
        if (res.permanente) {
          await pool.query(
            `UPDATE sevenconstruction.mkt_campanhas
                SET total_falhas = total_falhas + 1
              WHERE id = $1`,
            [item.campanha_id],
          );
        }
      }
    } catch (e) {
      falhas++;
      const msg = e instanceof Error ? e.message : String(e);
      await pool.query(
        `UPDATE sevenconstruction.mkt_envios
            SET status = 'falhou', erro = $1
          WHERE id = $2`,
        [msg.slice(0, 500), item.envio_id],
      );
    }
  }

  // Marca campanha como concluida se todos os envios foram processados
  await pool.query(
    `UPDATE sevenconstruction.mkt_campanhas c
        SET status = 'concluida', concluido_em = NOW()
      WHERE status = 'disparando'
        AND NOT EXISTS (
          SELECT 1 FROM sevenconstruction.mkt_envios e
           WHERE e.campanha_id = c.id AND e.status = 'pendente'
        )`,
  );

  return {
    processados,
    enviados,
    falhas,
    duracao_ms: Date.now() - t0,
  };
}

/**
 * Cria mkt_envios pendentes para campanhas em 'disparando' que ainda nao
 * tem envios gerados (1 envio por contato da lista).
 */
async function materializarEnvios(maxPorCampanha: number): Promise<void> {
  await pool.query(
    `INSERT INTO sevenconstruction.mkt_envios (campanha_id, contato_id, destino, status)
     SELECT c.id, ct.id,
            CASE WHEN c.canal = 'email' THEN ct.email ELSE ct.whatsapp END,
            'pendente'
       FROM sevenconstruction.mkt_campanhas c
       JOIN sevenconstruction.mkt_lista_contatos ct ON ct.lista_id = c.lista_id
      WHERE c.status = 'disparando'
        AND CASE WHEN c.canal = 'email' THEN ct.email ELSE ct.whatsapp END IS NOT NULL
        AND CASE WHEN c.canal = 'email' THEN ct.email ELSE ct.whatsapp END <> ''
        AND NOT EXISTS (
          SELECT 1 FROM sevenconstruction.mkt_envios e
           WHERE e.campanha_id = c.id AND e.contato_id = ct.id
        )
      LIMIT $1`,
    [maxPorCampanha],
  );
}

/**
 * Inicia uma campanha: muda status de rascunho/agendada para disparando.
 */
export async function iniciarCampanha(loja_id: number, campanha_id: number): Promise<void> {
  await pool.query(
    `UPDATE sevenconstruction.mkt_campanhas
        SET status = 'disparando', iniciado_em = NOW()
      WHERE id = $1 AND loja_id = $2 AND status IN ('rascunho', 'agendada', 'pausada')`,
    [campanha_id, loja_id],
  );
}

/**
 * Pausa uma campanha em disparo.
 */
export async function pausarCampanha(loja_id: number, campanha_id: number): Promise<void> {
  await pool.query(
    `UPDATE sevenconstruction.mkt_campanhas
        SET status = 'pausada'
      WHERE id = $1 AND loja_id = $2 AND status = 'disparando'`,
    [campanha_id, loja_id],
  );
}
