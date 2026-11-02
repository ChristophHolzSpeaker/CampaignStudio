CREATE TABLE form_consent_evidence (
 form_event_id uuid PRIMARY KEY REFERENCES lead_events(id) ON DELETE CASCADE,
 marketing_allowed boolean NOT NULL,
 policy_version text NOT NULL,
 evidence_ref text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX form_consent_evidence_expiry_idx ON form_consent_evidence(expires_at);
ALTER TABLE form_consent_evidence ENABLE ROW LEVEL SECURITY;
