import axios from "axios";
import BASE_URL from "../config/api";

export const login = (email, password) => {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);
  return axios.post(`${BASE_URL}/auth/login`, params);
};

export const register = (full_name, email, password) =>
  axios.post(`${BASE_URL}/auth/register`, { full_name, email, password });
