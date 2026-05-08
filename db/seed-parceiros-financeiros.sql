-- Seed de 3 parceiros financeiros mock pra demo do FIDC.
-- Idempotente via ON CONFLICT no nome.

INSERT INTO sevenconstruction.parceiros_financeiros
  (nome, tipo, taxa_minima_aa, taxa_maxima_aa, prazo_min_dias, prazo_max_dias,
   ticket_min, ticket_max, comissao_loja_pct, status, adapter_codigo, observacoes)
VALUES
  ('FIDC Construa+', 'fidc', 18.0, 36.0, 30, 360, 1000, 500000, 1.5,
   'ativo', 'mock_construa_v1',
   'FIDC focado em material de construção. Taxas competitivas pra rating verde.'),
  ('Banco Saturno', 'banco', 22.0, 48.0, 30, 720, 500, 1000000, 1.0,
   'ativo', 'mock_saturno_v1',
   'Banco digital — aceita ticket alto. Mais rigoroso em compliance.'),
  ('Factoring Express', 'factoring', 28.0, 60.0, 7, 90, 200, 100000, 2.5,
   'ativo', 'mock_factoring_v1',
   'Factoring para curto prazo. Aprovação rápida, taxa maior.')
ON CONFLICT DO NOTHING;

-- Vincula todos os parceiros a TODAS as lojas ativas
INSERT INTO sevenconstruction.loja_parceiros (loja_id, parceiro_id, ativo, prioridade)
SELECT l.id, pf.id, TRUE,
  CASE pf.tipo WHEN 'fidc' THEN 10 WHEN 'banco' THEN 20 ELSE 30 END
FROM sevenconstruction.lojas l
CROSS JOIN sevenconstruction.parceiros_financeiros pf
WHERE l.ativo
  AND pf.status = 'ativo'
ON CONFLICT (loja_id, parceiro_id) DO NOTHING;
