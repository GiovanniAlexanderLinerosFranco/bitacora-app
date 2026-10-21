-- Personal-layer billing for the Pro plan.
-- Kept off bitacora_profiles: that table lets the owner update their own row, so a plan
-- column there could be set to 'pro' without a payment. This table has no insert or update
-- policy. Only the service role, used by the signed Stripe webhook, writes it, and every
-- write is scoped to one bitacora_profiles id.

create table public.bitacora_subscriptions (
  user_id                 uuid primary key references public.bitacora_profiles (id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan_type               text not null default 'free' check (plan_type in ('free', 'pro')),
  subscription_status     text not null default 'canceled' check (subscription_status in ('active', 'canceled', 'past_due')),
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint bitacora_subscriptions_customer_id_chk
    check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  constraint bitacora_subscriptions_subscription_id_chk
    check (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$')
);

create unique index bitacora_subscriptions_customer_idx
  on public.bitacora_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index bitacora_subscriptions_subscription_idx
  on public.bitacora_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create trigger bitacora_subscriptions_updated_at
  before update on public.bitacora_subscriptions
  for each row execute function public.bitacora_set_updated_at();

alter table public.bitacora_subscriptions enable row level security;

create policy "bitacora_subscriptions_select_own"
  on public.bitacora_subscriptions
  for select using (user_id = (select auth.uid()));

revoke insert, update, delete on table public.bitacora_subscriptions from anon, authenticated;
