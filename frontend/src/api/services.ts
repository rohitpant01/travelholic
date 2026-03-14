import apiClient from './client';

// ============================================================
// AUTH API
// ============================================================
export const authAPI = {
  register: (data: any) => apiClient.post('/auth/register', data),
  login: (data: any) => apiClient.post('/auth/login', data),
  googleLogin: (idToken: string) => apiClient.post('/auth/google', { idToken }),
  sendOTP: (phone: string) => apiClient.post('/auth/send-otp', { phone }),
  verifyOTP: (phone: string, code: string, userId: string) =>
    apiClient.post('/auth/verify-otp', { phone, code, userId }),
  forgotPassword: (phone: string) => apiClient.post('/auth/forgot-password', { phone }),
  resetPassword: (phone: string, code: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { phone, code, newPassword }),
};

// ============================================================
// USER API
// ============================================================
export const userAPI = {
  getProfile: () => apiClient.get('/user/profile'),
  getUserById: (userId: string) => apiClient.get(`/user/${userId}`),
  updateProfile: (data: any) => apiClient.put('/user/update', data),
  uploadPhotos: (formData: FormData) =>
    apiClient.post('/user/photos', formData),
  deletePhoto: (photoId: string) => apiClient.delete(`/user/photos/${photoId}`),
  setProfilePhoto: (photoId: string) => apiClient.put(`/user/photos/${photoId}/profile`),
  verifySelfie: (formData: FormData) =>
    apiClient.post('/user/verify-selfie', formData),
  updateLocation: (data: { latitude: number, longitude: number }) => apiClient.post('/update-location', data),
  updateDistance: (maxDiscoveryDistance: number) =>
    apiClient.put('/user/distance', { maxDiscoveryDistance }),
  deactivateAccount: () => apiClient.delete('/user/account'),
};

// ============================================================
// DISCOVER API
// ============================================================
export const discoverAPI = {
  getProfiles: (lat?: number, lng?: number) => {
    const params = lat && lng ? `?lat=${lat}&lng=${lng}` : '';
    return apiClient.get(`/nearby-users${params}`);
  },
  like: (targetUserId: string) => apiClient.post('/discover/like', { targetUserId }),
  skip: (targetUserId: string) => apiClient.post('/discover/skip', { targetUserId }),
  superLike: (targetUserId: string) => apiClient.post('/discover/superlike', { targetUserId }),
};

// ============================================================
// MATCHES API
// ============================================================
export const matchAPI = {
  getMatches: () => apiClient.get('/matches'),
  unmatch: (matchId: string) => apiClient.delete(`/matches/${matchId}`),
};

// ============================================================
// CHAT API
// ============================================================
export const chatAPI = {
  getMessages: (matchId: string, page = 1) =>
    apiClient.get(`/chat/${matchId}/messages?page=${page}`),
  sendMessage: (matchId: string, text: string) =>
    apiClient.post(`/chat/${matchId}/send`, { text }),
  sendImage: (matchId: string, formData: FormData) =>
    apiClient.post(`/chat/${matchId}/send`, formData),
};
