/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  // Add other env variables as needed
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

