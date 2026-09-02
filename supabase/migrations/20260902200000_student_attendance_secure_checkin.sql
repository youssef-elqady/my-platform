-- Secure attendance token flow. Tokens are stored hashed; the plaintext is returned only at creation time.
create or replace function public.create_attendance_token(p_session_id uuid, p_minutes integer default 15)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
  v_expires timestamptz;
begin
  if not public.is_active_admin() and not public.has_staff_permission('attendance.manage') then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.sessions where id=p_session_id) then raise exception 'Session not found'; end if;
  v_token := encode(gen_random_bytes(18),'hex');
  v_hash := encode(digest(v_token,'sha256'),'hex');
  v_expires := least(timezone('utc',now()) + make_interval(mins => greatest(1,least(p_minutes,60))), timezone('utc',now()) + interval '60 minutes');
  update public.attendance_tokens set revoked_at=timezone('utc',now()) where session_id=p_session_id and revoked_at is null;
  insert into public.attendance_tokens(session_id,token_hash,expires_at) values(p_session_id,v_hash,v_expires);
  return v_token;
end;
$$;

revoke all on function public.create_attendance_token(uuid,integer) from public;
grant execute on function public.create_attendance_token(uuid,integer) to authenticated;

create or replace function public.student_check_in_attendance(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hash text;
  v_token_id uuid;
  v_session_id uuid;
  v_student_group uuid;
  v_session_group uuid;
  v_student_code text;
  v_status public.attendance_status := 'present';
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.users where id=v_user and role='student' and status='active') then raise exception 'Active student required'; end if;
  v_hash := encode(digest(trim(p_token),'sha256'),'hex');
  select at.id,at.session_id into v_token_id,v_session_id from public.attendance_tokens at where at.token_hash=v_hash and at.revoked_at is null and at.expires_at > timezone('utc',now()) limit 1;
  if v_token_id is null then raise exception 'Attendance code is invalid or expired'; end if;
  select s.group_id into v_student_group from public.students s where s.user_id=v_user;
  select s.group_id into v_session_group from public.sessions s where s.id=v_session_id;
  if v_student_group is null or v_session_group is null or v_student_group <> v_session_group then raise exception 'Student is not a member of this session group'; end if;
  select student_code into v_student_code from public.student_profiles where user_id=v_user limit 1;
  insert into public.attendance(session_id,student_id,status,manually_modified,modified_by,modified_at)
  values(v_session_id,v_user,v_status,false,v_user,timezone('utc',now()))
  on conflict(session_id,student_id) do update set status=excluded.status,marked_at=timezone('utc',now()),manually_modified=false,modified_by=v_user,modified_at=timezone('utc',now());
  return jsonb_build_object('success',true,'message','تم تسجيل حضورك بنجاح','student_code',v_student_code,'session_id',v_session_id);
end;
$$;

revoke all on function public.student_check_in_attendance(text) from public;
grant execute on function public.student_check_in_attendance(text) to authenticated;
