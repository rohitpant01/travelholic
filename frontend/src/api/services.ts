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
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { email, code, newPassword }),
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
  deactivateAccount: () => apiClient.post('/user/deactivate'),
  blockUser: (targetUserId: string) => apiClient.post('/user/block', { targetUserId }),
  unblockUser: (targetUserId: string) => apiClient.post('/user/unblock', { targetUserId }),
  getBlockedUsers: () => apiClient.get('/user/blocked'),
  reportUser: (data: { targetUserId: string; reason: string; details?: string; matchId?: string }) => 
    apiClient.post('/user/report', data),
  getMyReports: () => apiClient.get('/user/reports'),
  getMyReportDetails: (reportId: string) => apiClient.get(`/user/reports/${reportId}/details`),
  deleteAccount: (password: string) => apiClient.delete('/user/account', { data: { password } }),
  restoreAccount: () => apiClient.post('/user/cancel-deletion'),

  // ✅ NEW: Who liked me — returns { likedBy: User[], totalCount: number }
  whoLikedMe: () => apiClient.get('/user/who-liked-me'),

  // ✅ NEW: Who viewed my profile
  getProfileViews: () => apiClient.get('/user/views'),
  getVisitors: () => apiClient.get('/user/visitors'),

  // ✅ NEW: Like back a user who liked you
  likeBack: (targetUserId: string) => apiClient.post('/discover/like', { targetUserId }),

  addCompletedTrip: (data: any) => apiClient.post('/user/completed-trips', data),
  updateCompletedTrip: (tripId: string, data: any) => apiClient.put(`/user/completed-trips/${tripId}`, data),
  deleteCompletedTrip: (tripId: string) => apiClient.delete(`/user/completed-trips/${tripId}`),
  getCompletedTrips: (userId: string) => apiClient.get(`/user/${userId}/completed-trips`),
  saveDestination: (destination: any) => apiClient.post('/user/saved-destinations', destination),
  deleteSavedDestination: (destinationId: string) => apiClient.delete(`/user/saved-destinations/${destinationId}`),
  syncSavedDestinations: (localItems: any[]) => apiClient.post('/user/sync-saved-destinations', { localItems }),
  getReverseGeocode: (lat: number, lng: number) => apiClient.get(`/places/reverse-geocode?lat=${lat}&lng=${lng}`),
};

// ============================================================
// DISCOVER API
// ============================================================
export const discoverAPI = {
  getProfiles: (params: { 
    lat?: number; 
    lng?: number; 
    mode?: string; 
    sortBy?: string; 
    page?: number; 
    limit?: number; 
    searchCity?: string; 
  }) => {
    return apiClient.get('/nearby-users', {
      params: { ...params, travelBuddy: !!params.searchCity }
    });
  },
  like: (targetUserId: string) => apiClient.post('/discover/like', { targetUserId }),
  skip: (targetUserId: string) => apiClient.post('/discover/skip', { targetUserId }),
  superLike: (targetUserId: string) => apiClient.post('/discover/superlike', { targetUserId }),
  updateLocation: (lat: number, lng: number, city?: string, country?: string) => 
    apiClient.post('/discover/location', { lat, lng, city, country }),
  updateVisibility: (status: 'public' | 'ghost') => 
    apiClient.put('/discover/visibility', { status }),
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
  clearChat: (matchId: string) => apiClient.delete(`/chat/${matchId}/messages`),
};

// ============================================================
// TRIPS API
// ============================================================
export const tripAPI = {
  getTrips: (filters?: any) => apiClient.get('/trips', { params: filters }),
  getMyTrips: () => apiClient.get('/trips/my'),
  getSavedPlans: () => apiClient.get('/trips/saved'),
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
  reportTrip: (tripId: string, data: { reason: string; details?: string }) =>
    apiClient.post(`/trips/${tripId}/report`, data),
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

// ============================================================
// AI API
// ============================================================
export const aiAPI = {
  generateItinerary: (data: { 
    destination: string; 
    days: number; 
    budget?: string; 
    interests?: string; 
    travelType?: string; 
    startLocation?: string; 
    foodPreference?: string; 
  }) => apiClient.post('/ai/generate', data),
  getPlaceInsights: (data: { placeName: string; lat?: number; lng?: number; }) => apiClient.post('/ai/place-insights', data),
  generateQuote: (destination?: string) => apiClient.post('/ai/quote', { destination }),
  generateDestinations: () => apiClient.get('/ai/destinations'),
  getTopDestinations: () => apiClient.get('/ai/top-destinations'),
  saveItinerary: (data: any) => apiClient.post('/ai/itinerary/save', data),
  getMyItineraries: () => apiClient.get('/ai/itinerary/my'),
  publishItinerary: (id: string) => apiClient.post(`/ai/itinerary/${id}/publish`),
  deleteItinerary: (id: string) => apiClient.delete(`/ai/itinerary/${id}`),
};

// ============================================================
// LYRA AI ITINERARY API
// ============================================================
export const lyraAPI = {
  generate: (data: { caption: string; location?: any; tags?: string[] }) =>
    apiClient.post('/itinerary/lyra', data),
  save: (data: any) => apiClient.post('/itinerary/lyra/save', data),
  share: (id: string) => apiClient.post(`/itinerary/lyra/${id}/share`),
  clone: (id: string) => apiClient.post(`/itinerary/lyra/${id}/clone`),
  getMyItineraries: () => apiClient.get('/itinerary/my'),
  getLyraById: (id: string) => apiClient.get(`/itinerary/lyra/${id}`),
  delete: (id: string) => apiClient.delete(`/itinerary/lyra/${id}`),
};

// ============================================================
// FEED API
// ============================================================
export const feedAPI = {
  getFeed: (mode: string = 'global', page: number = 1) => 
    apiClient.get(`/feed?mode=${mode}&page=${page}`),
  getPost: (postId: string) => apiClient.get(`/feed/${postId}`),
  createPost: (formData: FormData, onUploadProgress?: (progressEvent: any) => void) => 
    apiClient.post('/feed/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
      onUploadProgress,
    }),
  toggleLike: (postId: string) => apiClient.post(`/feed/${postId}/like`),
  deletePost: (postId: string) => apiClient.delete(`/feed/${postId}`),
  editPost: (postId: string, data: { content?: string; placeName?: string }) => apiClient.put(`/feed/${postId}`, data),
  getPostLikes: (postId: string) => apiClient.get(`/feed/${postId}/likes`),
  getUserPosts: (userId: string, page: number = 1) => apiClient.get(`/feed/user/${userId}?page=${page}`),
  reportPost: (postId: string, data: { reason: string; details?: string }) => 
    apiClient.post(`/feed/${postId}/report`, data),
};

export const commentAPI = {
  getComments: (postId: string) => apiClient.get(`/comments/${postId}`),
  addComment: (postId: string, text: string) => apiClient.post(`/comments/${postId}`, { text }),
  editComment: (commentId: string, text: string) => apiClient.put(`/comments/${commentId}`, { text }),
  deleteComment: (commentId: string) => apiClient.delete(`/comments/${commentId}`),
};

export const storyAPI = {
  getStories: () => apiClient.get('/stories'),
  createStory: (formData: FormData) => 
    apiClient.post('/stories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    }),
  deleteStory: (storyId: string) => apiClient.delete(`/stories/${storyId}`),
  addView: (storyId: string) => apiClient.post(`/stories/${storyId}/view`),
  getViewers: (storyId: string) => apiClient.get(`/stories/${storyId}/views`),
};

// ============================================================
// ADMIN API (Hidden — only used by admin panel)
// ============================================================
export const adminAPI = {
  getReports: (params?: any) => apiClient.get('/admin/reports', { params }),
  getReportDetails: (id: string) => apiClient.get(`/admin/reports/${id}/details`),
  resolveReport: (id: string, data: any) => apiClient.put(`/admin/reports/${id}/resolve`, data),
  softDeleteContent: (id: string, reason?: string) => apiClient.put(`/admin/content/${id}/soft-delete`, { reason }),
  restoreContent: (id: string) => apiClient.put(`/admin/content/${id}/restore`),
  getUsers: (params?: any) => apiClient.get('/admin/users', { params }),
  suspendUser: (id: string, data: any) => apiClient.put(`/admin/users/${id}/suspend`, data),
  unsuspendUser: (id: string) => apiClient.put(`/admin/users/${id}/unsuspend`),
  warnUser: (id: string, reason: string) => apiClient.put(`/admin/users/${id}/warn`, { reason }),
  banUser: (id: string, reason: string) => apiClient.put(`/admin/users/${id}/ban`, { reason }),
  getStats: () => apiClient.get('/admin/stats'),
  getLogs: (params?: any) => apiClient.get('/admin/logs', { params }),
  changeUserRole: (id: string, role: string) => apiClient.put(`/admin/users/${id}/role`, { role }),
};