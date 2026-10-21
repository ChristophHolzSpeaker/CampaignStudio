-- Nullable preserves legacy consent integrations; runtime v6 requires an expiry.
ALTER TABLE visit_ad_consent ADD COLUMN expires_at timestamptz;
