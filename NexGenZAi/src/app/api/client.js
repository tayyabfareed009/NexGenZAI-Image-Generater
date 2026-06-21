import axios from 'axios';
import { getApiBaseUrl } from './config';

let getAuthToken = null;

export function registerAuthTokenGetter(tokenGetter) {
  getAuthToken = tokenGetter;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(async (config) => {
  if (!getAuthToken || config.headers.Authorization) {
    return config;
  }

  try {
    const token = await getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('Unable to attach auth token:', error.message);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Unable to reach the backend. Check that the server is running and EXPO_PUBLIC_API_BASE_URL is correct.';

    error.message = message;
    return Promise.reject(error);
  }
);

export default api;
