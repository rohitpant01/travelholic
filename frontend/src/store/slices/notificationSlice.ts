import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { notificationAPI } from '../../api/services';

export interface Notification {
  _id: string;
  recipient: string;
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
    photos: any[];
  };
  type: 'like' | 'comment' | 'match' | 'trip_join_request' | 'trip_accepted' | 'trip_message';
  title?: string;
  message: string;
  data?: {
    postId?: string;
    tripId?: string;
    matchId?: string;
  };
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
};

export const fetchNotifications = createAsyncThunk(
  'notification/fetchNotifications',
  async () => {
    const response = await notificationAPI.getNotifications();
    return response.data; // { notifications, unreadCount }
  }
);

export const markNotificationsRead = createAsyncThunk(
  'notification/markRead',
  async () => {
    await notificationAPI.markRead();
    return true;
  }
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
    clearAll: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    markAllRead: (state) => {
      state.unreadCount = 0;
      state.notifications = state.notifications.map(n => ({ ...n, isRead: true }));
    },
    markSingleRead: (state, action: PayloadAction<string>) => {
      const note = state.notifications.find(n => n._id === action.payload);
      if (note && !note.isRead) {
        note.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(markNotificationsRead.fulfilled, (state) => {
        state.unreadCount = 0;
        state.notifications = state.notifications.map(n => ({ ...n, isRead: true }));
      });
  },
});

export const { addNotification, setUnreadCount, clearAll, markAllRead, markSingleRead } = notificationSlice.actions;
export default notificationSlice.reducer;
