/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STACK_PROJECT_ID: string;
  readonly VITE_STACK_PUBLISHABLE_CLIENT_KEY: string;
  readonly VITE_DATA_API_URL: string;
  readonly VITE_NEON_BRANCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
