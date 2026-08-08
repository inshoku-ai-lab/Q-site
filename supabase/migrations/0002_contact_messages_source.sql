-- Lets contact_messages serve more than one form. The general /contact page
-- and the silver purchase inquiry on /silver share the exact same mechanism
-- (honeypot + timing check + Turnstile + rate limiting + Resend
-- notification + /admin/inquiries dashboard, see src/pages/api/contact.ts
-- and src/components/ContactForm.astro); `source` is how /admin/inquiries
-- tells the two apart.
alter table contact_messages add column if not exists source text not null default 'general';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_messages_source_check'
  ) then
    alter table contact_messages
      add constraint contact_messages_source_check
      check (source in ('general', 'silver'));
  end if;
end $$;
