import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const validateDataset = (file) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post(`${BASE_URL}/upload/validate`, form, { headers: authHeaders() });
};

export const saveDataset = (file, dataset_name, channel_store) => {
  const form = new FormData();
  form.append("file", file);
  form.append("dataset_name", dataset_name);
  form.append("channel_store", channel_store);
  return axios.post(`${BASE_URL}/upload/save`, form, { headers: authHeaders() });
};

export const getDatasets = () =>
  axios.get(`${BASE_URL}/upload/datasets`, { headers: authHeaders() });
