-- Teachers record that an excuse was reported. The office makes the final
-- excused/unexcused decision, so a pending report never consumes credit.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'excused_pending', 'excused', 'unexcused', 'trial', 'online'));
