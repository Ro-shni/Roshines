// filepath: /Users/siddhu/Downloads/Roshines/src/env.d.ts
// Type declarations so TypeScript knows about import.meta.env VITE_* variables
interface ImportMetaEnv {
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID: string;
  readonly VITE_EMAILJS_PUBLIC_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly BASE_URL: string;
  // add other VITE_ variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}