import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ChatState {
  totalUnread: number;        // total unread across all matches (for the tab badge)
  unreadByMatch: Record<string, number>; // matchId -> unread count
}

const initialState: ChatState = {
  totalUnread: 0,
  unreadByMatch: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Called when we receive unread counts from the server (on fetchMatches)
    setUnreadCounts(state, action: PayloadAction<{ matchId: string; count: number }[]>) {
      const byMatch: Record<string, number> = {};
      let total = 0;
      action.payload.forEach(({ matchId, count }) => {
        byMatch[matchId] = count;
        total += count;
      });
      state.unreadByMatch = byMatch;
      state.totalUnread = total;
    },
    // Called when a new message arrives via socket
    incrementUnread(state, action: PayloadAction<{ matchId: string }>) {
      const { matchId } = action.payload;
      state.unreadByMatch[matchId] = (state.unreadByMatch[matchId] || 0) + 1;
      state.totalUnread += 1;
    },
    // Called when user opens a chat and reads all messages
    clearUnreadForMatch(state, action: PayloadAction<string>) {
      const matchId = action.payload;
      const prev = state.unreadByMatch[matchId] || 0;
      state.totalUnread = Math.max(0, state.totalUnread - prev);
      state.unreadByMatch[matchId] = 0;
    },
    resetUnread(state) {
      state.totalUnread = 0;
      state.unreadByMatch = {};
    },
  },
});

export const { setUnreadCounts, incrementUnread, clearUnreadForMatch, resetUnread } = chatSlice.actions;
export default chatSlice.reducer;
