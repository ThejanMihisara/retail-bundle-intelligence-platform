import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getBundles = (params = {}) =>
  axios.get(`${BASE_URL}/bundles`, { 
    headers: authHeaders(),
    params
  });

export const getBundleById = (bundleId) =>
  axios.get(`${BASE_URL}/bundles/${bundleId}`, { headers: authHeaders() });

export const recommendBundles = (product, limit = 5) =>
  axios.get(`${BASE_URL}/bundles/recommend`, {
    headers: authHeaders(),
    params: { product, limit }
  });

export const getBundlesSummary = () =>
  axios.get(`${BASE_URL}/bundles/summary`, { headers: authHeaders() });

export const getBundlePeriodAnalysis = (params = {}, config = {}) =>
  axios.get(`${BASE_URL}/bundles/period-analysis`, {
    headers: authHeaders(),
    params,
    ...config,
  });

export const getAssociationRules = (params = {}) =>
  axios.get(`${BASE_URL}/bundles/rules`, { 
    headers: authHeaders(),
    params
  });
