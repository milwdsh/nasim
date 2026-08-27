-- NASIM ALIPANAH ART
-- Run this file in Supabase SQL Editor.
-- IMPORTANT: create the admin user from Supabase Dashboard > Authentication > Users.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price bigint not null default 0,
  stock integer not null default 0,
  dimensions text,
  material text,
  description text,
  cover_url text,
  gallery_urls text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  phone text not null,
  city text not null,
  province text not null default 'گیلان',
  address text not null,
  postal_code text,
  note text,
  shipping_method text not null,
  shipping_cost bigint not null default 0,
  subtotal bigint not null default 0,
  total bigint not null default 0,
  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','failed')),
  order_status text not null default 'pending_payment'
    check (order_status in ('pending_payment','paid','preparing','shipped','delivered','cancelled')),
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price bigint not null,
  quantity integer not null check (quantity > 0),
  image_url text
);

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  city text not null unique,
  post_cost bigint not null default 0,
  tipax_cost bigint not null default 0,
  courier_cost bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipping_rates enable row level security;

-- Public can read active products.
drop policy if exists "public read active products" on public.products;
create policy "public read active products"
on public.products for select
using (is_active = true or auth.role() = 'authenticated');

-- Admin (authenticated user) can manage products.
drop policy if exists "authenticated manage products" on public.products;
create policy "authenticated manage products"
on public.products for all to authenticated
using (true) with check (true);

-- Public checkout can create orders/items. In production, payment/backend
-- should be moved behind an Edge Function before enabling a real gateway.
drop policy if exists "public create orders" on public.orders;
create policy "public create orders"
on public.orders for insert to anon, authenticated
with check (true);

drop policy if exists "public create order items" on public.order_items;
create policy "public create order items"
on public.order_items for insert to anon, authenticated
with check (true);

-- Only authenticated admins can read/update orders and shipping rates.
drop policy if exists "authenticated read orders" on public.orders;
create policy "authenticated read orders"
on public.orders for select to authenticated using (true);

drop policy if exists "authenticated update orders" on public.orders;
create policy "authenticated update orders"
on public.orders for update to authenticated using (true) with check (true);

drop policy if exists "authenticated read order items" on public.order_items;
create policy "authenticated read order items"
on public.order_items for select to authenticated using (true);

drop policy if exists "authenticated read shipping" on public.shipping_rates;
create policy "authenticated read shipping"
on public.shipping_rates for select to authenticated using (true);

drop policy if exists "authenticated manage shipping" on public.shipping_rates;
create policy "authenticated manage shipping"
on public.shipping_rates for all to authenticated using (true) with check (true);

-- Storage bucket for product images.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "authenticated upload product images" on storage.objects;
create policy "authenticated upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

drop policy if exists "authenticated update product images" on storage.objects;
create policy "authenticated update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "authenticated delete product images" on storage.objects;
create policy "authenticated delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();
