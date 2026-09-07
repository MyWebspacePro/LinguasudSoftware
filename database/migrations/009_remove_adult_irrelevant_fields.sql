ALTER TABLE participant_profiles
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS emergency_name,
  DROP COLUMN IF EXISTS emergency_phone;
