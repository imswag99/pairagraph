import { api } from './api.js';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}`),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (idToken) => api.post('/auth/google', { idToken }),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
  updateProfile: (displayName) => api.patch('/auth/me', { displayName }),
  setProfileVisibility: (isProfilePublic) =>
    api.patch('/auth/me/profile-visibility', { isProfilePublic }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/me/change-password', { currentPassword, newPassword }),
  deleteAccount: () => api.del('/auth/me'),
};
