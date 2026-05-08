import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/frontend';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
};

export const maps = {
  list: () => api.get('/maps'),
  get: (id: string) => api.get(`/maps/${id}`),
  create: (data: any) => api.post('/maps', data),
  update: (id: string, data: any) => api.put(`/maps/${id}`, data),
  delete: (id: string) => api.delete(`/maps/${id}`),
};

export const bounties = {
  list: () => api.get('/bounties'),
  get: (id: string) => api.get(`/bounties/${id}`),
  create: (data: any) => api.post('/bounties', data),
  claim: (id: string) => api.post(`/bounties/${id}/claim`),
  complete: (id: string) => api.post(`/bounties/${id}/complete`),
};
