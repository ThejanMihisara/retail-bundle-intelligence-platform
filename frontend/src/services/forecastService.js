import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getDemandForecast = (params = {}) =>
  axios.get(`${BASE_URL}/forecast/demand`, { 
    headers: authHeaders(),
    params
  });

export const getProductForecast = (productId, months = 6) =>
  axios.get(`${BASE_URL}/forecast/product/${productId}`, { 
    headers: authHeaders(),
    params: { months }
  });

export const getCategoryForecast = (category, months = 6) =>
  axios.get(`${BASE_URL}/forecast/category/${category}`, { 
    headers: authHeaders(),
    params: { months }
  });

export const getForecastSummary = () =>
  axios.get(`${BASE_URL}/forecast/summary`, { headers: authHeaders() });

export const getFutureForecast = (params = {}) =>
  axios.get(`${BASE_URL}/forecast/future`, {
    headers: authHeaders(),
    params,
  });

export const getActualVsPredicted = (params = {}) =>
  axios.get(`${BASE_URL}/forecast/actual-vs-predicted`, {
    headers: authHeaders(),
    params,
  });

export const getComparisonDefaults = () =>
  axios.get(`${BASE_URL}/forecast/comparison-defaults`, {
    headers: authHeaders(),
  });

