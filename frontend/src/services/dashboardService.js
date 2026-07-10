import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getOverview = () =>
  axios.get(`${BASE_URL}/dashboard/overview`, { headers: authHeaders() });

export const getMonthlySales = () =>
  axios.get(`${BASE_URL}/dashboard/monthly-sales`, { headers: authHeaders() });

export const getCategoryPerformance = () =>
  axios.get(`${BASE_URL}/dashboard/category-performance`, { headers: authHeaders() });

export const getTopProducts = () =>
  axios.get(`${BASE_URL}/dashboard/top-products`, { headers: authHeaders() });

export const getRecentInsights = () =>
  axios.get(`${BASE_URL}/dashboard/recent-insights`, { headers: authHeaders() });
