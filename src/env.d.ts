// filepath: /Users/user/Documents/Roshines/src/env.d.ts
// Type declarations so TypeScript knows about import.meta.env VITE_* variables
interface ImportMetaEnv {
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID: string;
  readonly VITE_EMAILJS_PUBLIC_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;

  readonly BASE_URL: string; // Vite built-in: base URL from vite.config
  
  // Firebase Configuration
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}