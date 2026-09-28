-- Keep the structured identity values in sync with the administration selects.
ALTER TABLE participant_profiles DROP CONSTRAINT IF EXISTS participant_profiles_salutation_check;
ALTER TABLE participant_profiles
  ADD CONSTRAINT participant_profiles_salutation_check
  CHECK (salutation IS NULL OR salutation IN ('frau', 'herr', 'divers', 'keine_angabe'));

ALTER TABLE participant_profiles DROP CONSTRAINT IF EXISTS participant_profiles_gender_check;
ALTER TABLE participant_profiles
  ADD CONSTRAINT participant_profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('weiblich', 'männlich', 'divers', 'keine_angabe'));

ALTER TABLE teacher_profiles DROP CONSTRAINT IF EXISTS teacher_profiles_salutation_check;
ALTER TABLE teacher_profiles
  ADD CONSTRAINT teacher_profiles_salutation_check
  CHECK (salutation IS NULL OR salutation IN ('frau', 'herr', 'divers', 'keine_angabe'));

ALTER TABLE teacher_profiles DROP CONSTRAINT IF EXISTS teacher_profiles_gender_check;
ALTER TABLE teacher_profiles
  ADD CONSTRAINT teacher_profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('weiblich', 'männlich', 'divers', 'keine_angabe'));
