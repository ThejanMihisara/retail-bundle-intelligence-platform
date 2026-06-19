import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const analyzeFastSlow = (payload) =>
  axios.post(`${BASE_URL}/fast-slow/analyze`, payload, { headers: authHeaders() });

export const getFastSlowResults = () =>
  axios.get(`${BASE_URL}/fast-slow/results`, { headers: authHeaders() });
