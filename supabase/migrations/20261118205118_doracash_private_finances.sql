create schema doracash;
revoke all on schema doracash from public, anon;
grant usage on schema doracash to authenticated;

-- Provision one empty row per approved account outside this migration.
create table doracash.finanzas (
  titular uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  datos jsonb,
  actualizado timestamptz,
  check (datos is null or (
    jsonb_typeof(datos) = 'object' and datos ?& array['periods','goals','theme']
    and jsonb_typeof(datos->'periods') = 'array' and jsonb_typeof(datos->'goals') = 'array'
    and datos->>'theme' in ('dark','light')
  ))
);
alter table doracash.finanzas enable row level security;
revoke all on doracash.finanzas from public, anon, authenticated;
grant select, update(datos, revision, actualizado) on doracash.finanzas to authenticated;
create policy leer_propio on doracash.finanzas for select to authenticated
  using (titular = (select auth.uid()));
create policy guardar_propio on doracash.finanzas for update to authenticated
  using (titular = (select auth.uid())) with check (titular = (select auth.uid()));

create function public.doracash_leer()
returns table(revision bigint, datos jsonb)
language sql stable security invoker set search_path = ''
as $$ select f.revision, f.datos from doracash.finanzas f where titular = (select auth.uid()) $$;

create function public.doracash_guardar(version_previa bigint, documento jsonb)
returns bigint language sql volatile security invoker set search_path = ''
as $$
  update doracash.finanzas set datos = documento, revision = revision + 1, actualizado = now()
  where titular = (select auth.uid()) and revision = version_previa and documento is not null
  returning revision
$$;
revoke all on function public.doracash_leer(), public.doracash_guardar(bigint,jsonb) from public, anon;
grant execute on function public.doracash_leer(), public.doracash_guardar(bigint,jsonb) to authenticated;

-- Expense-only projection for the authorized Notion import; no goals, income or balances.
create view doracash.gastos with (security_invoker = true) as
select f.titular, p->>'id' as quincena_id, m->>'id' as movimiento_id,
  m->>'kind' as tipo, m->>'date' as fecha, m->>'name' as concepto,
  c->>'name' as categoria, m->>'amount' as importe, 'NIO'::text as moneda
from doracash.finanzas f
cross join lateral jsonb_array_elements(f.datos->'periods') p
cross join lateral jsonb_array_elements(coalesce(nullif(p->'movements','null'::jsonb),'[]'::jsonb)) m
left join lateral (
  select categoria as c from jsonb_array_elements(p->'categories') categoria
  where categoria->>'id' = m->>'categoryId' limit 1
) category_info on true
where m->>'kind' in ('expense', 'payment');
revoke all on doracash.gastos from public, anon, authenticated;
