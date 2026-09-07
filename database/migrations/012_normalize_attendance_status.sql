-- The school records participant absences only as excused or unexcused.
-- Normalize the legacy status before tightening the constraint.
UPDATE attendance
SET status = 'unexcused'
WHERE status = 'cancelled_short_notice';

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'excused', 'unexcused', 'trial', 'online'));
