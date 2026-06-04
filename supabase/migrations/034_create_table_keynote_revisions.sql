-- =============================================================================
-- Migration: keynote_revisions
-- Source:    SQLite-Sidecar (keynote_revisions.db) → Supabase public-Schema
-- Datum:     2026-06-04
--
-- Spiegelt das bisherige SQLite-Schema 1:1 plus Postgres-Verbesserungen:
--   - BIGINT IDENTITY statt INTEGER AUTOINCREMENT
--   - TIMESTAMPTZ statt TEXT für created_at
--   - Foreign Key auf public.keynotes(id) mit CASCADE
--   - Mehrere Indexes für die typischen Abfragepfade
--   - Row-Level-Security wie bei public.keynotes
--   - Revisionen sind unveränderlich: keine UPDATE/DELETE-Policy
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tabelle
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.keynote_revisions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    talk_id       TEXT        NOT NULL
                  REFERENCES public.keynotes(id) ON DELETE CASCADE,
    field         TEXT        NOT NULL,
    value_before  TEXT,
    value_after   TEXT,
    source        TEXT        NOT NULL DEFAULT 'manual',
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.keynote_revisions IS
    'Versionsverlauf aller Feldänderungen an public.keynotes — inkl. der lokal in image_prompts.db gepflegten image_prompt-Werte.';
COMMENT ON COLUMN public.keynote_revisions.talk_id IS
    'FK auf public.keynotes(id). CASCADE: bei Löschung des Talks wandert der Verlauf mit.';
COMMENT ON COLUMN public.keynote_revisions.field IS
    'Local-shape Feldname: title | subtitle | short | long | speaker | moderation | audience | image | status | image_prompt';
COMMENT ON COLUMN public.keynote_revisions.source IS
    'Herkunft der Änderung: manual | chat-claude | chat-claude-apply | chat-claude-image | chat-claude-auto | chat-gemini | chat-gemini-apply | chat-gemini-auto | restore | migration';
COMMENT ON COLUMN public.keynote_revisions.value_before IS
    'Wert vor der Änderung. NULL = Feld war zuvor leer/NULL.';
COMMENT ON COLUMN public.keynote_revisions.value_after IS
    'Wert nach der Änderung. NULL = Feld wurde geleert.';

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_keynote_revisions_talk_time
    ON public.keynote_revisions (talk_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_keynote_revisions_talk_field_time
    ON public.keynote_revisions (talk_id, field, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_keynote_revisions_source_time
    ON public.keynote_revisions (source, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Row-Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.keynote_revisions ENABLE ROW LEVEL SECURITY;

-- Lesezugriff: jeder User darf den Verlauf sehen, inklusive anon
CREATE POLICY "keynote_revisions_read_public"
    ON public.keynote_revisions
    FOR SELECT
    TO public
    USING (true);

-- Schreibzugriff: nur INSERT, kein UPDATE/DELETE — Revisionen sind unveränderlich
CREATE POLICY "keynote_revisions_insert_authenticated"
    ON public.keynote_revisions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Bewusst KEINE UPDATE- oder DELETE-Policy.
-- Löschungen passieren ausschließlich via ON DELETE CASCADE,
-- wenn der referenzierte Talk in public.keynotes gelöscht wird.

-- -----------------------------------------------------------------------------
-- 4. Hilfsview (optional, für schnelle "letzte N pro Talk"-Abfragen)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_keynote_revisions_latest AS
SELECT DISTINCT ON (talk_id, field)
       id, talk_id, field, value_before, value_after, source, note, created_at
FROM   public.keynote_revisions
ORDER  BY talk_id, field, created_at DESC, id DESC;

COMMENT ON VIEW public.v_keynote_revisions_latest IS
    'Pro (talk_id, field) die jüngste Revision — praktisch für „was war die letzte Änderung an Feld X von Talk Y?"';

COMMIT;

-- =============================================================================
-- ROLLBACK (separat ausführbar bei Bedarf)
-- =============================================================================
-- BEGIN;
-- DROP VIEW  IF EXISTS public.v_keynote_revisions_latest;
-- DROP TABLE IF EXISTS public.keynote_revisions CASCADE;
-- COMMIT;
