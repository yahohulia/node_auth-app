import api from './index.js';

export const authApi = {
  register: (name, email, password) =>
    api.post('/api/registration', { name, email, password }),

  login: (email, password) => api.post('/api/login', { email, password }),

  logout: () => api.post('/api/logout'),

  refresh: () => api.get('/api/refresh'),

  resetPassword: (email) => api.post('/api/reset-password', { email }),

  confirmResetPassword: (confirmToken, newPassword1, newPassword2) =>
    api.post(`/api/reset-password/${confirmToken}`, {
      newPassword1,
      newPassword2,
    }),
};
