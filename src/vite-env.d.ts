/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Cross-domain link target for "Customer Site" / "Back to Customer Site". Unset in local dev. */
  readonly VITE_CUSTOMER_SITE_URL?: string;
  /** Cross-domain link target for "Staff Login". Unset in local dev. */
  readonly VITE_STAFF_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
