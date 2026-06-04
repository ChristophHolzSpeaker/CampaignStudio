BEGIN;

DO $$
BEGIN
    CREATE TYPE public.keynote_status AS ENUM ('active', 'draft', 'review', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.keynotes
    ADD COLUMN IF NOT EXISTS priority INTEGER,
    ADD COLUMN IF NOT EXISTS status public.keynote_status NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS image_prompt TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'keynotes_priority_range_check'
          AND conrelid = 'public.keynotes'::regclass
    ) THEN
        ALTER TABLE public.keynotes
            ADD CONSTRAINT keynotes_priority_range_check
            CHECK (priority IS NULL OR priority BETWEEN 1 AND 10);
    END IF;
END
$$;

COMMENT ON COLUMN public.keynotes.priority IS
    'Optional ranking value from 1 to 10; lower numbers can be treated as higher priority.';
COMMENT ON COLUMN public.keynotes.status IS
    'Lifecycle state of the keynote: active | draft | review | archived.';
COMMENT ON COLUMN public.keynotes.image_prompt IS
    'Long-form prompt used to generate or refine keynote imagery.';

COMMIT;
