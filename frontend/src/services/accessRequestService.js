import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const submitAccessRequest = (data) =>
  axios.post(`${BASE_URL}/access-requests`, data);

export const getAccessRequests = (status = "") =>
  axios.get(`${BASE_URL}/access-requests`, {
    headers: authHeaders(),
    params: status ? { status } : {},
  });

export const approveAccessRequest = (id, data) =>
  axios.patch(
    `${BASE_URL}/access-requests/${id}/approve`,
    data,
    { headers: authHeaders() }
  );

export const rejectAccessRequest = (id) =>
  axios.patch(`${BASE_URL}/access-requests/${id}/reject`, {}, { headers: authHeaders() });

export const deleteAccessRequest = (id) =>
  axios.delete(`${BASE_URL}/access-requests/${id}`, { headers: authHeaders() });
