-- =========================================================
-- SevenConstruction — Catalogo de servicos v2 (30+ servicos)
-- Inspirado no concierge SevenLicite. 2 modos:
-- - 'automatica': emissor publico, cliente emite via link sozinho
-- - 'concierge': loja faz pelo cliente (comissao maior)
-- =========================================================

ALTER TABLE sevenconstruction.servicos_catalogo
  ADD COLUMN IF NOT EXISTS modo TEXT,
  -- 'automatica' | 'concierge' | 'paga' (API)
  ADD COLUMN IF NOT EXISTS emissor TEXT,
  ADD COLUMN IF NOT EXISTS link_emissor TEXT,
  ADD COLUMN IF NOT EXISTS prerequisito TEXT;
  -- ex: "Precisa CNPJ ativo", "Sócio com CPF regular"
