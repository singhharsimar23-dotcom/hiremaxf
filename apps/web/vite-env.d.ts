/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ChromeRuntime {
  lastError?: { message?: string };
  sendMessage: (extensionId: string, message: unknown, callback?: (response: unknown) => void) => void;
}

interface ChromeNamespace {
  runtime: ChromeRuntime;
}

interface Window {
  chrome?: ChromeNamespace;
  aistudio?: {
    openSelectKey: () => Promise<void>;
  };
}

declare const chrome: ChromeNamespace;

