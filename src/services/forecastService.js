import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const runForecast = (payload) =>
  axios.post(`${BASE_URL}/forecast/run`, payload, { headers: authHeaders() });

export const getForecastProducts = () =>
  axios.get(`${BASE_URL}/forecast/products`, { headers: authHeaders() });
