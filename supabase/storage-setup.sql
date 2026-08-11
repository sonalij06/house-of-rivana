-- House of Rivana — Supabase Storage buckets & policies
--
-- Run this in the Supabase SQL Editor after creating a project
-- (Dashboard → SQL → New query), OR let `npm run storage:setup` create
-- the buckets via the Storage API and then run the policies below.
--
-- product-images  → public  (storefront + next/image)
-- payment-proofs  → private (admin-only short-lived signed URLs)

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    8388608, -- 8 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'payment-proofs',
    'payment-proofs',
    false,
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies
-- Uploads from the Next.js app use the service role key (bypasses RLS).
-- These policies cover any future client-side or anon access correctly.
-- ---------------------------------------------------------------------------

-- Public read for product photography
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- Authenticated staff may upload product images (optional; service role already can)
drop policy if exists "Staff upload product images" on storage.objects;
create policy "Staff upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Staff update product images" on storage.objects;
create policy "Staff update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Staff delete product images" on storage.objects;
create policy "Staff delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- Payment proofs: no public select. Service role signs URLs for admins.
-- Block anon/authenticated direct reads just to be explicit.
drop policy if exists "No public payment proof reads" on storage.objects;
create policy "No public payment proof reads"
  on storage.objects for select
  to anon, authenticated
  using (false);
