const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const BASE_URL = normalizedBaseUrl.endsWith("/api")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api`;

export default BASE_URL;
