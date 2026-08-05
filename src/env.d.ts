/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly RESEND_API_KEY?: string;
  readonly CONTACT_NOTIFY_EMAIL?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly AIRTABLE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
