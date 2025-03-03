export const envConstant = {
  BACKEND_BASE_URL: import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8000/api/v1",

  ASSEMBLYAI_API_KEY: import.meta.env.VITE_ASSEMBLYAI_API_KEY || "",

  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",

  ELEVEN_LABS_API_KEY: import.meta.env.VITE_ELEVEN_LABS_API_KEY || "",
};

