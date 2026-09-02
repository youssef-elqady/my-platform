-- Normalize legacy assistant permission payloads so existing accounts work with the shared permission model.
update public.staff_members
set permissions = jsonb_build_object(
  'permissions', (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(
      case
        when jsonb_typeof(permissions->'permissions') = 'object' then permissions->'permissions'
        else coalesce(permissions, '{}'::jsonb)
      end
    ) as x(k,v)
  )
)
where permissions is not null;

-- Add read aliases for older management permissions without granting new capabilities.
update public.staff_members
set permissions = jsonb_set(
  permissions,
  '{permissions}',
  (
    permissions->'permissions'
    || case when coalesce((permissions->'permissions'->>'lessons.manage')::boolean,false) then '{"content.read":true}'::jsonb else '{}'::jsonb end
    || case when coalesce((permissions->'permissions'->>'assignments.manage')::boolean,false) then '{"assignments.read":true}'::jsonb else '{}'::jsonb end
    || case when coalesce((permissions->'permissions'->>'notifications.manage')::boolean,false) then '{"notifications.read":true}'::jsonb else '{}'::jsonb end
  ),
  true
)
where permissions ? 'permissions';
