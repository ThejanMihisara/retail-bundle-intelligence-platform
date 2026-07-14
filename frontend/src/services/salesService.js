import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getSales = (params = {}) =>
  axios.get(`${BASE_URL}/sales`, { 
    headers: authHeaders(),
    params
  });

export const getSalesSummary = (params = {}) =>
  axios.get(`${BASE_URL}/sales/summary`, { headers: authHeaders(), params });

export const getSalesMonthly = (params = {}) =>
  axios.get(`${BASE_URL}/sales/monthly`, { headers: authHeaders(), params });

export const getSalesCategories = () =>
  axios.get(`${BASE_URL}/sales/categories`, { headers: authHeaders() });

export const uploadCsv = (file) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post(`${BASE_URL}/sales/upload-csv`, form, {
    headers: {
      ...authHeaders(),
      "Content-Type": "multipart/form-data"
    }
  });
};

export const clearSales = () =>
  axios.delete(`${BASE_URL}/sales/clear`, { headers: authHeaders() });
