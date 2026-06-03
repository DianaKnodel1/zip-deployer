export const BACKEND_URL = "https://api.mb-portal.com";

export const BACKEND_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MDY4MDAwLCJleHAiOjE5MzQ4MzQ0MDB9.e6amaZA_liDEuRmH1TaHZaDOcDT8Io-M5SP2VdDTYeA";

export const backendFunctionUrl = (functionName: string) =>
  `${BACKEND_URL}/functions/v1/${functionName}`;