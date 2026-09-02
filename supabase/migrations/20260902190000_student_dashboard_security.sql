-- Student dashboard security primitives.
-- The browser may request these actions, but authorization is enforced here in Postgres.

alter table public.notifications
  add column if not exists action_url text,
  add column if not exists is_one_time boolean not null default false,
  add column if not exists is_consumed boolean not null default false,
  add column if not exists token uuid not null default gen_random_uuid();

create unique index if not exists notifications_token_unique_idx
on public.notifications(token);

create index if not exists notifications_recipient_consumed_idx
on public.notifications(recipient_id, is_consumed, created_at desc);

create table if not exists public.student_exam_access (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  access_token uuid not null default gen_random_uuid(),
  status text not null default 'claimed',
  claimed_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  constraint student_exam_access_status_valid check (status in ('claimed','submitted','expired')),
  constraint student_exam_access_unique unique (student_id, exam_id)
);

alter table public.student_exam_access enable row level security;

drop policy if exists student_exam_access_own_read on public.student_exam_access;
create policy student_exam_access_own_read
on public.student_exam_access for select to authenticated
using (student_id = (select auth.uid()));

create or replace function public.consume_notification(p_notification_id uuid)
returns table(action_url text, consumed boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  return query
  update public.notifications n
     set is_read = true,
         read_at = coalesce(n.read_at, timezone('utc', now())),
         is_consumed = case when n.is_one_time then true else n.is_consumed end
   where n.id = p_notification_id
     and n.recipient_id = auth.uid()
     and n.is_read = false
  returning n.action_url, true;
end;
$$;

revoke all on function public.consume_notification(uuid) from public;
grant execute on function public.consume_notification(uuid) to authenticated;

create or replace function public.claim_exam_access(p_exam_id uuid)
returns table(access_id uuid, access_token uuid, allowed boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams%rowtype;
  v_access public.student_exam_access%rowtype;
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if not exists (
    select 1 from public.student_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.user_id = v_uid and sp.status = 'active' and p.is_active = true
  ) then
    return query select null::uuid, null::uuid, false, 'الحساب غير مفعل'::text;
    return;
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found then
    return query select null::uuid, null::uuid, false, 'الامتحان غير موجود'::text;
    return;
  end if;

  if v_exam.starts_at is not null and timezone('utc', now()) < v_exam.starts_at then
    return query select null::uuid, null::uuid, false, 'الامتحان لم يبدأ بعد'::text;
    return;
  end if;
  if v_exam.ends_at is not null and timezone('utc', now()) > v_exam.ends_at then
    return query select null::uuid, null::uuid, false, 'انتهى وقت الامتحان'::text;
    return;
  end if;

  select * into v_access from public.student_exam_access where student_id = v_uid and exam_id = p_exam_id;
  if found then
    return query select v_access.id, null::uuid, false, 'تم استخدام هذا الامتحان من قبل ولا يمكن الدخول إليه مرة أخرى'::text;
    return;
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.student_id = v_uid and gm.ends_at is null
  order by gm.starts_at desc limit 1;

  if v_exam.group_id is not null and v_exam.group_id is distinct from v_group_id then
    return query select null::uuid, null::uuid, false, 'هذا الامتحان غير مخصص لمجموعتك'::text;
    return;
  end if;

  if v_exam.grade_id is not null and not exists (
    select 1 from public.groups g where g.id = v_group_id and g.grade_id = v_exam.grade_id
  ) then
    return query select null::uuid, null::uuid, false, 'هذا الامتحان غير مخصص لصفك'::text;
    return;
  end if;

  insert into public.student_exam_access(student_id, exam_id)
  values (v_uid, p_exam_id)
  returning * into v_access;

  return query select v_access.id, v_access.access_token, true, 'تم فتح الامتحان بنجاح'::text;
exception when unique_violation then
  return query select null::uuid, null::uuid, false, 'تم استخدام هذا الامتحان من قبل ولا يمكن الدخول إليه مرة أخرى'::text;
end;
$$;

revoke all on function public.claim_exam_access(uuid) from public;
grant execute on function public.claim_exam_access(uuid) to authenticated;
