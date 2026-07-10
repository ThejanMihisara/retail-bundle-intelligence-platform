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

export const searchMovement = (query) =>
  axios.get(`${BASE_URL}/products/movement/search`, {
    headers: authHeaders(),
    params: { query }
  });
