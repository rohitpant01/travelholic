import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import tripReducer from './slices/tripSlice';
import notificationReducer from './slices/notificationSlice';
import themeReducer from './slices/themeSlice';
import savedReducer from './slices/savedSlice';
import feedReducer from './slices/feedSlice';
import storyReducer from './slices/storySlice';
import checklistReducer from './slices/checklistSlice';
import uploadReducer from './slices/uploadSlice';
import commentReducer from './slices/commentSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    trip: tripReducer,
    notification: notificationReducer,
    theme: themeReducer,
    saved: savedReducer,
    feed: feedReducer,
    stories: storyReducer,
    uploads: uploadReducer,
    comments: commentReducer,
    checklist: checklistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
