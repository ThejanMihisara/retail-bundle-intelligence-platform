import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getProductMovement = (params = {}) =>
  axios.get(`${BASE_URL}/products/movement`, { 
    headers: authHeaders(),
    params
  });

export const getMovementSummary = () =>
  axios.get(`${BASE_URL}/products/movement/summary`, { headers: authHeaders() });

export const getMovementPeriodAnalysis = (params = {}) =>
  axios.get(`${BASE_URL}/products/movement/period-analysis`, {
    headers: authHeaders(),
    params,
  });

export const searchMovement = (query) =>
  axios.get(`${BASE_URL}/products/movement/search`, {
    headers: authHeaders(),
    params: { query }
  });

export const getMovementPredictions = (params = {}) =>
  axios.get(`${BASE_URL}/products/movement/predict`, {
    headers: authHeaders(),
    params
  });

