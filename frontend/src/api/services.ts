import apiClient from './client';

// ============================================================
// AUTH API
// ============================================================
export const authAPI = {
  register: (data: any) => apiClient.post('/auth/register', data),
  login: (data: any) => apiClient.post('/auth/login', data),
  googleLogin: (idToken: string) => apiClient.post('/auth/google', { idToken }),
  sendOTP: (phone: string, checkExists?: boolean) => apiClient.post('/auth/send-otp', { phone, checkExists }),
  verifyOTP: (phone: string, code: string, userId: string) =>
    apiClient.post('/auth/verify-otp', { phone, code, userId }),
  forgotPassword: (phone: string) => apiClient.post('/auth/forgot-password', { phone }),
  resetPassword: (phone: string, code: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { phone, code, newPassword }),
  sendEmailOTP: (email?: string, userId?: string) => apiClient.post('/auth/send-email-otp', { email, userId }),
  verifyEmailOTP: (email: string | undefined, code: string, userId?: string) =>
    apiClient.post('/auth/verify-email-otp', { email, code, userId }),
  changeEmail: (newEmail: string, password?: string) =>
    apiClient.post('/auth/change-email', { newEmail, password }),
};

// ============================================================
// USER API
// ============================================================
export const userAPI = {
  // ✅ Returns axios response — always access .data.user from the caller
  getProfile: () => apiClient.get('/user/profile'),
  getUserById: (userId: string) => apiClient.get(`/user/${userId}`),
  updateProfile: (data: any) => apiClient.put('/user/update', data),
  uploadPhotos: (formData: FormData) => 
    apiClient.post('/user/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    }),
  deletePhoto: (photoId: string) => apiClient.delete(`/user/photos/${photoId}`),
  setProfilePhoto: (photoId: string) => apiClient.put(`/user/photos/${photoId}/profile`),
  verifySelfie: (formData: FormData) => 
    apiClient.post('/user/verify-selfie', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    }),
  updateLocation: (data: { latitude: number; longitude: number }) =>
    apiClient.post('/update-location', data),
  updateDistance: (maxDiscoveryDistance: number) =>
    apiClient.put('/user/distance', { maxDiscoveryDistance }),
  followUser: (userId: string) => apiClient.post(`/user/follow/${userId}`),
  deactivateAccount: () => apiClient.delete('/user/account'),

  // ✅ NEW: Who liked me — returns { likedBy: User[], totalCount: number }
  whoLikedMe: () => apiClient.get('/user/who-liked-me'),

  // ✅ NEW: Like back a user who liked you
  likeBack: (targetUserId: string) => apiClient.post('/discover/like', { targetUserId }),

  addCompletedTrip: (data: any) => apiClient.post('/user/completed-trips', data),
  updateCompletedTrip: (tripId: string, data: any) => apiClient.put(`/user/completed-trips/${tripId}`, data),
  deleteCompletedTrip: (tripId: string) => apiClient.delete(`/user/completed-trips/${tripId}`),
  getCompletedTrips: (userId: string) => apiClient.get(`/user/${userId}/completed-trips`),
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
  pinMatch: (matchId: string) => apiClient.post(`/chat/${matchId}/pin`),
  muteMatch: (matchId: string) => apiClient.post(`/chat/${matchId}/mute`),
};

// ============================================================
// CHAT API
// ============================================================
export const chatAPI = {
  getMessages: (matchId: string, page = 1) =>
    apiClient.get(`/chat/${matchId}/messages?page=${page}`),
  sendMessage: (matchId: string, text: string) =>
    apiClient.post(`/chat/${matchId}/send`, { text }),
  sendImage: (matchId: string, image: any, replyTo?: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: image.uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);
    if (replyTo) formData.append('replyTo', replyTo);
    return apiClient.post(`/chat/${matchId}/send`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  sendVoice: (matchId: string, audio: any, replyTo?: string) => {
    const formData = new FormData();
    formData.append('audio', {
      uri: audio.uri,
      name: 'voice.m4a',
      type: 'audio/m4a',
    } as any);
    if (replyTo) formData.append('replyTo', replyTo);
    return apiClient.post(`/chat/${matchId}/send-voice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  editMessage: (messageId: string, text: string) =>
    apiClient.patch(`/chat/message/${messageId}`, { text }),
  deleteMessage: (messageId: string) =>
    apiClient.delete(`/chat/message/${messageId}`),
  reactToMessage: (messageId: string, emoji: string | null) =>
    apiClient.post(`/chat/message/${messageId}/react`, { emoji }),
  getUnreadCount: () => apiClient.get('/chat/unread-count'),
  readChat: (matchId: string) => apiClient.put(`/chat/${matchId}/read`),
};

// ============================================================
// TRIPS API
// ============================================================
export const tripAPI = {
  getTrips: (filters?: any) => apiClient.get('/trips', { params: filters }),
  getMyTrips: () => apiClient.get('/trips/my'),
  getTrip: (id: string) => apiClient.get(`/trips/${id}`),
  createTrip: (data: any) => apiClient.post('/trips', data),
  updateTrip: (id: string, data: any) => apiClient.put(`/trips/${id}`, data),
  deleteTrip: (id: string) => apiClient.delete(`/trips/${id}`),
  joinTrip: (id: string, message?: string) => apiClient.post(`/trips/${id}/join`, { message }),
  handleMember: (tripId: string, userId: string, action: string) =>
    apiClient.put(`/trips/${tripId}/members/${userId}`, { action }),
  removeMember: (tripId: string, userId: string) =>
    apiClient.delete(`/trips/${tripId}/members/${userId}`),
  getPendingRequests: (tripId: string) => apiClient.get(`/trips/${tripId}/requests`),
  getTripMessages: (tripId: string, page = 1) =>
    apiClient.get(`/trips/${tripId}/messages?page=${page}`),
  sendTripMessage: (tripId: string, data: any) =>
    apiClient.post(`/trips/${tripId}/messages`, data),
  sendTripMedia: (tripId: string, image: any, tempId?: string, replyTo?: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: image.uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);
    if (tempId) formData.append('tempId', tempId);
    if (replyTo) formData.append('replyTo', replyTo);
    return apiClient.post(`/trips/${tripId}/send-media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  pinTrip: (tripId: string) => apiClient.post(`/trips/${tripId}/pin`),
  muteTrip: (tripId: string) => apiClient.post(`/trips/${tripId}/mute`),
  leaveTrip: (tripId: string, userId: string) => apiClient.delete(`/trips/${tripId}/members/${userId}`),
  sendTripVoice: (tripId: string, audio: any, tempId?: string, replyTo?: string) => {
    const formData = new FormData();
    formData.append('audio', {
      uri: audio.uri,
      name: 'voice.m4a',
      type: 'audio/m4a',
    } as any);
    if (tempId) formData.append('tempId', tempId);
    if (replyTo) formData.append('replyTo', replyTo);
    return apiClient.post(`/trips/${tripId}/send-voice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteTripMessage: (tripId: string, messageId: string) =>
    apiClient.delete(`/trips/${tripId}/messages/${messageId}`),
  editTripMessage: (tripId: string, messageId: string, text: string) =>
    apiClient.put(`/trips/${tripId}/messages/${messageId}`, { text }),
  reactTripMessage: (tripId: string, messageId: string, emoji: string) =>
    apiClient.post(`/trips/${tripId}/messages/${messageId}/react`, { emoji }),
  updateGroupInfo: (tripId: string, formData: FormData) =>
    apiClient.put(`/trips/${tripId}/group-info`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (d) => d,
    }),
};

// ============================================================
// NOTIFICATIONS API
// ============================================================
export const notificationAPI = {
  getNotifications: () => apiClient.get('/notifications'),
  markRead: (notificationIds?: string[]) => 
    apiClient.put('/notifications/read', { notificationIds }),
  clearNotifications: () => apiClient.delete('/notifications'),
};