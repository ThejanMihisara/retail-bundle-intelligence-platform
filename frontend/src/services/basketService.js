import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const generateRules = (payload) =>
  axios.post(`${BASE_URL}/basket/generate`, payload, { headers: authHeaders() });

export const getRules = () =>
  axios.get(`${BASE_URL}/basket/rules`, { headers: authHeaders() });

export const applyRules = () =>
  axios.post(`${BASE_URL}/basket/apply`, {}, { headers: authHeaders() });
