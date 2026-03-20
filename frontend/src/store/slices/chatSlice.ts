import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ChatState {
  totalUnread: number;         // total unread messages (kept for badge compatibility)
  chatsWithUnread: number;     // count of chats that have unread messages (for tab badge)
  unreadByMatch: Record<string, number>; // matchId -> unread count
  matches: any[];              // global match list
  activeMatchId: string | null; // tracking currently open chat
}

const initialState: ChatState = {
  totalUnread: 0,
  chatsWithUnread: 0,
  unreadByMatch: {},
  matches: [],
  activeMatchId: null,
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
      state.chatsWithUnread = Object.values(byMatch).filter(c => c > 0).length;
    },
    setMatches(state, action: PayloadAction<any[]>) {
      let total = 0;
      const byMatch: Record<string, number> = {};

      state.matches = action.payload.map(newMatch => {
        const matchId = String(newMatch.matchId);
        const count = newMatch.unreadCount || 0;
        byMatch[matchId] = count;
        total += count;
        return { ...newMatch, unreadCount: count };
      });

      state.unreadByMatch = byMatch;
      state.totalUnread = total;
      state.chatsWithUnread = Object.values(byMatch).filter(c => c > 0).length;
      console.log(`[REDUX] setMatches: ${state.chatsWithUnread} chats with unread, ${total} total messages`);
    },
    upsertMessage(state, action: PayloadAction<{ message: any; currentUserId: string }>) {
      const { message: msg, currentUserId } = action.payload;
      const msgMatchId = String(msg.matchId || msg.chatId);
      const index = state.matches.findIndex(m => String(m.matchId) === msgMatchId || String(m._id) === msgMatchId);
      
      const senderId = String(msg.sender?._id || msg.sender);
      // Backend might send receiver as an object or just ID string
      const receiverId = String(msg.receiver?._id || msg.receiver);
      const meId = String(currentUserId);

      if (index !== -1) {
        const match = { ...state.matches[index] };
        let label = msg.text || '';
        if (msg.type === 'image') label = '📷 Photo';
        if (msg.type === 'voice') label = '🎤 Voice message';
        if (msg.type === 'location') label = '📍 Location';

        const oldMsgId = match.lastMessage?._id;
        const newMsgId = msg._id;
        const isDuplicate = oldMsgId && newMsgId && String(oldMsgId) === String(newMsgId);

        match.lastMessage = {
          text: label,
          sentAt: msg.createdAt,
          sentBy: senderId,
          status: msg.status || 'sent',
          _id: msg._id
        };

        // Increment unread if match is not active AND I am the receiver AND not a duplicate
        const isActive = String(state.activeMatchId) === msgMatchId;
        const isTargetedAtMe = meId === receiverId;
        
        console.log(`[REDUX] upsertMessage: active=${isActive}, targetingMe=${isTargetedAtMe}, duplicate=${isDuplicate}`);

        if (!isActive && isTargetedAtMe && !isDuplicate) {
           match.unreadCount = (match.unreadCount || 0) + 1;
           state.unreadByMatch[msgMatchId] = (state.unreadByMatch[msgMatchId] || 0) + 1;
           state.totalUnread += 1;
           if (match.unreadCount === 1) state.chatsWithUnread += 1;
        }

        const updatedMatches = [...state.matches];
        updatedMatches.splice(index, 1);
        state.matches = [match, ...updatedMatches];
      } else {
        console.warn(`[REDUX] upsertMessage: matchId ${msgMatchId} not found in matches list!`);
        // Fallback: we could add a partial match or just ignore as before
      }
    },
    upsertTripMessage(state, action: PayloadAction<{ message: any; currentUserId: string }>) {
      const { message: msg, currentUserId } = action.payload;
      const tripId = String(msg.trip || msg.chatId || msg.tripId);
      const index = state.matches.findIndex(m => String(m.matchId) === tripId);
      
      const meId = String(currentUserId);
      const senderId = String(msg.sender?._id || msg.sender);

      if (index !== -1) {
        const match = { ...state.matches[index] };
        const oldMsgId = match.lastMessage?._id;
        const newMsgId = msg._id;
        const isDuplicate = oldMsgId && newMsgId && String(oldMsgId) === String(newMsgId);

        let label = msg.text || '';
        if (msg.type === 'image') label = '📷 Photo';
        if (msg.type === 'voice') label = '🎤 Voice message';
        if (msg.type === 'location') label = '📍 Location';

        match.lastMessage = {
          text: label,
          sentAt: msg.createdAt,
          sentBy: senderId,
          senderName: msg.sender?.firstName || msg.senderName,
          type: msg.type,
          _id: msg._id
        };

        // Increment unread if chat is not active AND I am not the sender AND not a duplicate
        const isActive = String(state.activeMatchId) === tripId;
        const isFromMe = meId === senderId;
        
        console.log(`[REDUX] upsertTripMessage: active=${isActive}, fromMe=${isFromMe}, duplicate=${isDuplicate}`);

        if (!isActive && !isFromMe && !isDuplicate) {
           match.unreadCount = (match.unreadCount || 0) + 1;
           state.unreadByMatch[tripId] = (state.unreadByMatch[tripId] || 0) + 1;
           state.totalUnread += 1;
           if (match.unreadCount === 1) state.chatsWithUnread += 1;
        }

        const updatedMatches = [...state.matches];
        updatedMatches.splice(index, 1);
        state.matches = [match, ...updatedMatches];
      } else {
        console.warn(`[REDUX] upsertTripMessage: tripId ${tripId} not found in matches list!`);
        // Even if trip is not in list, we MUST increment the total count if criteria match
        const isActive = String(state.activeMatchId) === tripId;
        const isFromMe = meId === senderId;
        const alreadyCounted = (state.unreadByMatch[tripId] || 0) > 0;
        
        if (!isActive && !isFromMe && !alreadyCounted) {
          state.totalUnread += 1;
          state.unreadByMatch[tripId] = (state.unreadByMatch[tripId] || 0) + 1;
          state.chatsWithUnread += 1;
        }
      }
    },
    updateMatchOnlineStatus(state, action: PayloadAction<{ userId: string; isOnline: boolean; activityStatus?: string; lastSeen?: string }>) {
      const { userId, isOnline, activityStatus, lastSeen } = action.payload;
      state.matches = state.matches.map(m => 
        String(m.user?._id) === String(userId) 
          ? { 
              ...m, 
              user: { 
                ...m.user, 
                isOnline, 
                activityStatus: activityStatus || m.user?.activityStatus, 
                lastSeen: lastSeen || m.user?.lastSeen 
              } 
            } 
          : m
      );
    },
    setActiveChat(state, action: PayloadAction<string | null>) {
      console.log(`[REDUX] setActiveChat: ${action.payload} (Current Total: ${state.totalUnread})`);
      state.activeMatchId = action.payload;
      if (action.payload) {
        const matchId = action.payload;
        const prev = state.unreadByMatch[matchId] || 0;
        state.totalUnread = Math.max(0, state.totalUnread - prev);
        if (prev > 0) state.chatsWithUnread = Math.max(0, state.chatsWithUnread - 1);
        state.unreadByMatch[matchId] = 0;
        state.matches = state.matches.map(m => 
          m.matchId === matchId ? { ...m, unreadCount: 0 } : m
        );
      }
    },
    clearUnreadForMatch(state, action: PayloadAction<string>) {
      const matchId = action.payload;
      const prev = state.unreadByMatch[matchId] || 0;
      state.totalUnread = Math.max(0, state.totalUnread - prev);
      if (prev > 0) state.chatsWithUnread = Math.max(0, state.chatsWithUnread - 1);
      state.unreadByMatch[matchId] = 0;
      state.matches = state.matches.map(m => 
        m.matchId === matchId ? { ...m, unreadCount: 0 } : m
      );
    },
    addMatch(state, action: PayloadAction<any>) {
      const newMatch = action.payload;
      const exists = state.matches.find(m => String(m.matchId) === String(newMatch.matchId));
      if (!exists) {
        state.matches = [newMatch, ...state.matches];
      }
    },
    setTotalUnread(state, action: PayloadAction<number>) {
      state.totalUnread = action.payload;
      // Recompute chatsWithUnread from current unreadByMatch
      state.chatsWithUnread = Object.values(state.unreadByMatch).filter(c => c > 0).length;
    },
    resetUnread(state) {
      state.totalUnread = 0;
      state.unreadByMatch = {};
    },
    togglePin(state, action: PayloadAction<string>) {
      const matchId = action.payload;
      state.matches = state.matches.map(m => 
        String(m.matchId) === String(matchId) ? { ...m, pinned: !m.pinned, isPinned: !m.isPinned } : m
      );
    },
    toggleMute(state, action: PayloadAction<string>) {
      const matchId = action.payload;
      state.matches = state.matches.map(m => 
        String(m.matchId) === String(matchId) ? { ...m, muted: !m.muted, isMuted: !m.isMuted } : m
      );
    },
    removeMatch(state, action: PayloadAction<string>) {
      const matchId = action.payload;
      state.matches = state.matches.filter(m => String(m.matchId) !== String(matchId));
      const prev = state.unreadByMatch[matchId] || 0;
      state.totalUnread = Math.max(0, state.totalUnread - prev);
      if (prev > 0) state.chatsWithUnread = Math.max(0, state.chatsWithUnread - 1);
      delete state.unreadByMatch[matchId];
    },
  },
});

export const { 
  setUnreadCounts, 
  setMatches, 
  upsertMessage, 
  upsertTripMessage,
  updateMatchOnlineStatus, 
  setActiveChat, 
  clearUnreadForMatch, 
  addMatch,
  setTotalUnread,
  resetUnread,
  togglePin,
  toggleMute,
  removeMatch
} = chatSlice.actions;
export default chatSlice.reducer;
