// filepath: /Users/siddhu/Downloads/Roshines/src/env.d.ts
// Type declarations so TypeScript knows about import.meta.env VITE_* variables
interface ImportMetaEnv {
  readonly VITE_ADMIN_PASSWORD?: string;
  // add other VITE_ variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}