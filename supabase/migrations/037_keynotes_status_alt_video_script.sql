BEGIN;

ALTER TYPE public.keynote_status ADD VALUE IF NOT EXISTS 'alt';

ALTER TABLE public.keynotes
    ADD COLUMN IF NOT EXISTS video_script TEXT;

COMMENT ON COLUMN public.keynotes.video_script IS
    'Optional promotional video script for the keynote.';

COMMIT;
