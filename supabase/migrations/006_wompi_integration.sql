-- National checkout (Wompi, Colombian pesos) on the same personal billing row as Stripe.
-- The owner still cannot insert or update this table. The signed Wompi webhook writes it
-- with the service role and always scopes the row by one bitacora_profiles id.

alter table public.bitacora_subscriptions
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists wompi_transaction_id text,
  add column if not exists wompi_reference text;

alter table public.bitacora_subscriptions
  drop constraint if exists bitacora_subscriptions_provider_chk;

alter table public.bitacora_subscriptions
  add constraint bitacora_subscriptions_provider_chk
    check (payment_provider in ('stripe', 'wompi'));

alter table public.bitacora_subscriptions
  drop constraint if exists bitacora_subscriptions_wompi_transaction_chk;

alter table public.bitacora_subscriptions
  add constraint bitacora_subscriptions_wompi_transaction_chk
    check (wompi_transaction_id is null or wompi_transaction_id ~ '^[A-Za-z0-9-]{8,80}$');

alter table public.bitacora_subscriptions
  drop constraint if exists bitacora_subscriptions_wompi_reference_chk;

alter table public.bitacora_subscriptions
  add constraint bitacora_subscriptions_wompi_reference_chk
    check (
      wompi_reference is null
      or wompi_reference ~ '^bt-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}$'
    );

create unique index if not exists bitacora_subscriptions_wompi_transaction_idx
  on public.bitacora_subscriptions (wompi_transaction_id)
  where wompi_transaction_id is not null;

create unique index if not exists bitacora_subscriptions_wompi_reference_idx
  on public.bitacora_subscriptions (wompi_reference)
  where wompi_reference is not null;
