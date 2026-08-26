import axios from 'axios';
import { getMemoryToken } from './authToken';

export const api = axios.create({
  baseURL: 'https://donation-app-m535.onrender.com',
});

api.interceptors.request.use((config) => {
  const token = getMemoryToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
