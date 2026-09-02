-- Notification compatibility: the original schema uses body/read_at while the admin suite uses message/is_read.
-- This migration runs before the admin suite migration and keeps both contracts synchronized.

alter table public.notifications
  add column if not exists message text;

alter table public.notifications
  add column if not exists is_read boolean;

update public.notifications
set message = coalesce(message, body, ''),
    is_read = coalesce(is_read, read_at is not null)
where message is null or is_read is null;

alter table public.notifications
  alter column message set default '',
  alter column message set not null,
  alter column is_read set default false,
  alter column is_read set not null;

create or replace function public.sync_notification_compatibility()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.message is distinct from old.message and new.body is not distinct from old.body then
    new.body := new.message;
  elsif new.body is distinct from old.body and new.message is not distinct from old.message then
    new.message := new.body;
  elsif new.message is null then
    new.message := coalesce(new.body, '');
  end if;

  if new.is_read is distinct from old.is_read and new.read_at is not distinct from old.read_at then
    new.read_at := case when new.is_read then coalesce(new.read_at, timezone('utc', now())) else null end;
  elsif new.read_at is distinct from old.read_at and new.is_read is not distinct from old.is_read then
    new.is_read := new.read_at is not null;
  else
    new.is_read := coalesce(new.is_read, new.read_at is not null);
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_compatibility_sync on public.notifications;
create trigger notifications_compatibility_sync
before insert or update on public.notifications
for each row execute function public.sync_notification_compatibility();

create index if not exists notifications_recipient_read_idx
on public.notifications(recipient_id, is_read, created_at desc);