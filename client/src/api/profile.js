import api from './index.js';

export const profileApi = {
  getProfile: () => api.get('/api/profile'),

  changeName: (name) => api.post('/api/profile/change-name', { name }),

  changePassword: (oldPassword, newPassword1, newPassword2) =>
    api.post('/api/profile/change-password', {
      oldPassword,
      newPassword1,
      newPassword2,
    }),

  changeEmail: (password, newEmail) =>
    api.post('/api/profile/change-email', { password, newEmail }),
};
