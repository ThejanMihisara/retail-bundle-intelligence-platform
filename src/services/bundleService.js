import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getBundleRecommendations = () =>
  axios.get(`${BASE_URL}/bundles/recommendations`, { headers: authHeaders() });

export const approveBundle = (bundleId) =>
  axios.post(`${BASE_URL}/bundles/approve/${bundleId}`, {}, { headers: authHeaders() });

export const getApprovedBundles = () =>
  axios.get(`${BASE_URL}/bundles/approved`, { headers: authHeaders() });
