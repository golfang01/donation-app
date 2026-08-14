import axios from 'axios';
import { getMemoryToken } from './authToken';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
});

api.interceptors.request.use((config) => {
  const token = getMemoryToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});