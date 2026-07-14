import axios from "axios";
import BASE_URL from "../config/api";
import authHeaders from "./http";

export const getUsers = () =>
  axios.get(`${BASE_URL}/users`, { headers: authHeaders() });

export const getCurrentUser = () =>
  axios.get(`${BASE_URL}/users/me`, { headers: authHeaders() });

export const updateUserRole = (id, role) =>
  axios.patch(`${BASE_URL}/users/${id}/role`, null, {
    headers: authHeaders(),
    params: { role },
  });

export const updateUserStatus = (id, status) =>
  axios.patch(`${BASE_URL}/users/${id}/status`, null, {
    headers: authHeaders(),
    params: { status },
  });

export const approveUser = (id) =>
  axios.patch(`${BASE_URL}/users/${id}/approve`, {}, { headers: authHeaders() });

export const deleteUser = (id) =>
  axios.delete(`${BASE_URL}/users/${id}`, { headers: authHeaders() });
