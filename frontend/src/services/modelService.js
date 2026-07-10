import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getModelStatus = () =>
  axios.get(`${BASE_URL}/models/status`, { headers: authHeaders() });

export const getRfSummary = () =>
  axios.get(`${BASE_URL}/models/random-forest/summary`, { headers: authHeaders() });

export const getRfFeatureImportance = () =>
  axios.get(`${BASE_URL}/models/random-forest/feature-importance`, { headers: authHeaders() });

export const getFpSummary = () =>
  axios.get(`${BASE_URL}/models/fp-growth/summary`, { headers: authHeaders() });
