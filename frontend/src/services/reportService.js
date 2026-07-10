import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getSummary = () =>
  axios.get(`${BASE_URL}/reports/summary`, { headers: authHeaders() });

export const exportCsv = () =>
  axios.get(`${BASE_URL}/reports/export/csv`, {
    headers: authHeaders(),
    responseType: "blob",
  });

export const getDashboardStats = () =>
  axios.get(`${BASE_URL}/dashboard/stats`, { headers: authHeaders() });
