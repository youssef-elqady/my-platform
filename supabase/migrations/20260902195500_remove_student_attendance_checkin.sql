-- Attendance is recorded only by the teacher/admin or authorized assistants.
-- Students may still SELECT their own attendance history through the existing RLS policy.
-- Remove the previous SECURITY DEFINER self-check-in RPC so a student cannot bypass the UI and register attendance from the browser console.
revoke all on function public.student_check_in_attendance(text) from public;
revoke all on function public.student_check_in_attendance(text) from anon;
revoke all on function public.student_check_in_attendance(text) from authenticated;
drop function if exists public.student_check_in_attendance(text);

-- The staff token creation function remains available only to authenticated users,
-- and its own authorization check requires admin or attendance.manage permission.
revoke all on function public.create_attendance_token(uuid,integer) from public;
grant execute on function public.create_attendance_token(uuid,integer) to authenticated;
