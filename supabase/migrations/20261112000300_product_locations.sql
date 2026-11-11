-- =====================================================================
-- PHASE 2b — PRODUK PER PABRIK (Q8) + MINIMUM STOK DEFAULT 100 (Q9)
-- Produksi hanya boleh untuk produk yang terdaftar di pabrik tsb (dipakai Phase 5).
-- Dapat diubah Super Owner kapan saja.
-- =====================================================================

create table public.product_locations (
  finished_item_id  uuid not null references public.items (id),
  location_id       uuid not null references public.locations (id),
  created_by        uuid references public.profiles (id) default app.uid(),
  created_at        timestamptz not null default now(),
  primary key (finished_item_id, location_id)
);
create index product_locations_location_idx on public.product_locations (location_id);

create function app.validate_product_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select type from public.items where id = new.finished_item_id) <> 'FINISHED_GOOD' then
    raise exception 'INVALID_ITEM_TYPE: hanya produk jadi yang bisa didaftarkan ke pabrik';
  end if;
  if (select type from public.locations where id = new.location_id) <> 'FACTORY' then
    raise exception 'VALIDATION: lokasi harus bertipe pabrik';
  end if;
  return new;
end;
$$;
create trigger product_locations_validate before insert or update on public.product_locations
  for each row execute function app.validate_product_location();

create function app.audit_product_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.product_locations := coalesce(new, old);
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    app.uid(), 'PRODUCT_LOCATIONS_' || tg_op, 'product_locations',
    v_row.finished_item_id::text || ':' || v_row.location_id::text,
    case when tg_op = 'DELETE' then to_jsonb(old) end,
    case when tg_op = 'INSERT' then to_jsonb(new) end
  );
  return v_row;
end;
$$;
create trigger product_locations_audit after insert or delete on public.product_locations
  for each row execute function app.audit_product_location();

revoke all on function app.validate_product_location(), app.audit_product_location() from public;

revoke all on public.product_locations from anon, authenticated;
grant select, insert, delete on public.product_locations to authenticated;
alter table public.product_locations enable row level security;

create policy product_locations_select on public.product_locations for select to authenticated
  using ((select app.my_role()) is not null);
create policy product_locations_insert on public.product_locations for insert to authenticated
  with check ((select app.is_super_owner()));
create policy product_locations_delete on public.product_locations for delete to authenticated
  using ((select app.is_super_owner()));

-- Data awal (Q8). Kemranjen: Herbal SN 35/100, Dragon SN, Bima Power, Dopping Dewa, Dragon Merpati.
-- Produk jadi lainnya: Cilacap.
insert into public.product_locations (finished_item_id, location_id)
select i.id, l.id
  from public.items i
  join public.locations l
    on l.code = case
         when i.sku in ('FG-001', 'FG-002', 'FG-003', 'FG-004', 'FG-009', 'FG-010') then 'PBR-KMJ'
         else 'PBR-CLP'
       end
 where i.type = 'FINISHED_GOOD'
   and i.sku like 'FG-%'
on conflict do nothing;

-- Q9: minimum stok default 100 (satuan dasar), tetap bisa diatur per barang.
alter table public.items alter column min_stock set default 100;
update public.items set min_stock = 100 where min_stock = 50 and updated_at = created_at;
