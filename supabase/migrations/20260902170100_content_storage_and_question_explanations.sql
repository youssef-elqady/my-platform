-- Content storage and question explanation hardening.
alter table public.exam_questions add column if not exists explanation text;

insert into storage.buckets (id, name, public)
values ('platform-files', 'platform-files', false)
on conflict (id) do update set public = false;

-- Authenticated admins and permitted assistants may upload/read platform files.
drop policy if exists platform_files_admin_insert on storage.objects;
create policy platform_files_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'platform-files'
  and ((select public.is_active_admin()) or (select public.has_staff_permission('lessons.manage')) or (select public.has_staff_permission('assignments.manage')))
);

drop policy if exists platform_files_admin_read on storage.objects;
create policy platform_files_admin_read on storage.objects
for select to authenticated
using (
  bucket_id = 'platform-files'
  and ((select public.is_active_admin()) or (select public.has_staff_permission('lessons.manage')) or (select public.has_staff_permission('assignments.manage')))
);

drop policy if exists platform_files_admin_delete on storage.objects;
create policy platform_files_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'platform-files'
  and ((select public.is_active_admin()) or (select public.has_staff_permission('lessons.manage')) or (select public.has_staff_permission('assignments.manage')))
);
