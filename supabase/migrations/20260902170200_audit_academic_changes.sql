-- Extend audit coverage to the records that matter most operationally.
drop trigger if exists audit_exam_attempts on public.exam_attempts;
create trigger audit_exam_attempts after insert or update or delete on public.exam_attempts for each row execute function public.write_audit_log();

drop trigger if exists audit_student_profiles on public.student_profiles;
create trigger audit_student_profiles after insert or update or delete on public.student_profiles for each row execute function public.write_audit_log();

drop trigger if exists audit_lessons on public.lessons;
create trigger audit_lessons after insert or update or delete on public.lessons for each row execute function public.write_audit_log();

drop trigger if exists audit_content_targets on public.content_targets;
create trigger audit_content_targets after insert or update or delete on public.content_targets for each row execute function public.write_audit_log();
