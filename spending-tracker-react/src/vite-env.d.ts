/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEXCLAVE_PROJECT_ID: string;
  readonly VITE_HEXCLAVE_PUBLISHABLE_CLIENT_KEY: string;
  readonly VITE_HEXCLAVE_SECRET_KEY?: string;
  readonly VITE_DATA_API_URL: string;
  readonly VITE_NEON_BRANCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
