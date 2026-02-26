import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

function isNetworkError(err) {
  return err?.code === 'ERR_NETWORK' || err?.message === 'Network Error';
}

function isLikelyProductionMisconfig() {
  if (typeof window === 'undefined') return false;
  const apiPointsToLocalhost = !API_BASE || API_BASE.includes('localhost') || API_BASE.startsWith('http://127.0.0.1');
  const appNotOnLocalhost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  return apiPointsToLocalhost && appNotOnLocalhost;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (isNetworkError(err) && isLikelyProductionMisconfig()) {
      err.message = "Can't reach the server. If you're the admin, set VITE_API_URL to your backend URL when building the frontend (see .env.example).";
    }
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refreshToken');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
          localStorage.setItem('accessToken', data.data.accessToken);
          if (data.data.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        } catch (_) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        if (!original.url?.includes('/auth/login')) window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
