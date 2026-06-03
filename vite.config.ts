import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const BACKEND_URL = "https://api.mb-portal.com";
const BACKEND_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MDY4MDAwLCJleHAiOjE5MzQ4MzQ0MDB9.e6amaZA_liDEuRmH1TaHZaDOcDT8Io-M5SP2VdDTYeA";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(BACKEND_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(BACKEND_ANON_KEY),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(BACKEND_ANON_KEY),
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
