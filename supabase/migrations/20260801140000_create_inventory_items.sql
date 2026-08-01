create table public.inventory_items (
  id uuid primary key,
  label text not null check (length(trim(label)) > 0),
  category text not null check (category in ('standard', 'flavor')),
  sort_order integer not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;

create policy "public_read_visible_inventory_items"
on public.inventory_items
for select
to anon
using (is_visible = true);

grant select, insert, update, delete on public.inventory_items to service_role;
