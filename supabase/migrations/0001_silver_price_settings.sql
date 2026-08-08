-- Silver purchase-agency price settings.
--
-- A single editable row holding the four independent fee percentages used
-- to compute the final JPY price shown on /silver from the free spot-price
-- feed:
--   final = spotUsd
--         * (1 + dealer_fee_pct/100)          -- precious-metals dealer's premium (USD)
--         * usdJpyRate                         -- FX conversion to JPY
--         * (1 + fx_fee_pct/100)               -- remittance/FX spread
--         * (1 + consumption_tax_pct/100)      -- Japanese consumption tax
--         * (1 + gs_fee_pct/100)               -- GS's own margin
--
-- Edited via /admin/silver-settings; read by the public /silver page.
-- Both go through the service-role admin client (see src/lib/supabase/admin.ts),
-- so RLS is enabled with no policies -- no anon/authenticated-role access at all.
create table if not exists silver_price_settings (
  id smallint primary key default 1,
  dealer_fee_pct numeric not null default 14,
  fx_fee_pct numeric not null default 1,
  consumption_tax_pct numeric not null default 10,
  gs_fee_pct numeric not null default 5,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint silver_price_settings_singleton check (id = 1)
);

alter table silver_price_settings enable row level security;

-- Seed the single row with defaults from MEMORY.md (dealer ~14%, fx+tax
-- previously combined at ~11% => split 1% fx / 10% tax, GS 5%). Adjust
-- anytime via /admin/silver-settings after this migration runs.
insert into silver_price_settings (id)
values (1)
on conflict (id) do nothing;
