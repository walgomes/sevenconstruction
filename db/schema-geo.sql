-- Geocoding: lat/lng em parceiros e lojas pra calcular distancia
-- (diferencial #1 do SRM SC vs Pipefy generico — geo-aware scoring).
-- Coordenadas vem da BrasilAPI v2 a partir do CEP.

SET search_path = sevenconstruction, public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'sevenconstruction' AND table_name = 'parceiros' AND column_name = 'lat'
  ) THEN
    ALTER TABLE sevenconstruction.parceiros
      ADD COLUMN lat DECIMAL(9,6),
      ADD COLUMN lng DECIMAL(9,6),
      ADD COLUMN geocoded_em TIMESTAMPTZ;
    CREATE INDEX idx_parceiros_geo ON sevenconstruction.parceiros(lat, lng) WHERE lat IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'sevenconstruction' AND table_name = 'lojas' AND column_name = 'lat'
  ) THEN
    ALTER TABLE sevenconstruction.lojas
      ADD COLUMN lat DECIMAL(9,6),
      ADD COLUMN lng DECIMAL(9,6),
      ADD COLUMN geocoded_em TIMESTAMPTZ;
  END IF;
END $$;
