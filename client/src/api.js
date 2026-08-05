import axios from 'axios';

// Detecta automáticamente la URL del backend:
// - En desarrollo local usa el proxy de Vite (/api)
// - Desde otra máquina usa la IP del servidor donde corre el backend
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocalhost ? '/api' : `http://${window.location.hostname}:3001/api`;

const api = axios.create({
  baseURL: BASE_URL
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;