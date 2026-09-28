-- Store the exact text the visitor accepted, even if the website wording changes.
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_text TEXT;

ALTER TABLE placement_tests
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_text TEXT;
