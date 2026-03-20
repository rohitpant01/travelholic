import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { matchAPI, userAPI, tripAPI, chatAPI } from '../api/services';
import { setUnreadCounts, setMatches, setActiveChat } from '../store/slices/chatSlice';
import { updateUser } from '../store/slices/authSlice';
import { RootState } from '../store';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { Modal, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { togglePin, toggleMute, removeMatch, clearUnreadForMatch } from '../store/slices/chatSlice';

interface Match {
  matchId: string;
  user: {
    _id: string;
    firstName: string;
    profilePhoto?: string;
    isOnline?: boolean;
    activityStatus?: string;
    lastSeen?: string;
    age?: number;
    city?: string;
    country?: string;
    isPhotoVerified?: boolean;
    origin?: { city: string };
    destination?: { city: string };
    travelDate?: string;
  };
  lastMessage?: { text: string; sentAt: string; sentBy: string };
  unreadCount?: number;
  distanceKm?: number | null;
  matchedAt: string;
}

export default function MatchesScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const currentUserId = useSelector((s: RootState) => s.auth.user?._id);

  // ✅ Read from Redux state - this ensures real-time updates from App.tsx listeners
  const matches = useSelector((s: RootState) => s.chat.matches);
  const sortedMatches = React.useMemo(() => {
    return [...matches].sort((a, b) => {
      // 1. Pinned first
      const aPinned = a.pinned || a.isPinned ? 1 : 0;
      const bPinned = b.pinned || b.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      // 2. Latest message/match time
      const timeA = new Date(a.lastMessage?.sentAt || a.matchedAt).getTime();
      const timeB = new Date(b.lastMessage?.sentAt || b.matchedAt).getTime();
      return timeB - timeA;
    });
  }, [matches]);

  const totalUnread = useSelector((s: RootState) => s.chat.totalUnread);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);



  const handleLongPress = (match: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMatch(match);
    setIsSheetVisible(true);
  };
  console.log(`[MatchesScreen] Current Global Total: ${totalUnread}`);
  const likesReceived = useSelector((s: RootState) => s.auth.user?.likesReceived || 0);

  const [loading, setLoading] = useState(matches.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAllChats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [matchRes, tripRes] = await Promise.all([
        matchAPI.getMatches(),
        tripAPI.getMyTrips()
      ]);
      
      const privateMatches = matchRes.data.matches.map((m: any) => ({ ...m, type: 'private' }));
      const groupTrips = tripRes.data.trips.map((t: any) => ({
        matchId: t._id,
        type: 'group',
        user: {
          _id: t._id,
          firstName: t.groupName || t.name || `${t.source?.city} → ${t.destination?.city}`,
          profilePhoto: t.groupIcon || null,
          isOnline: false,
        },
        lastMessage: t.lastMessage,
        matchedAt: t.createdAt,
        isTrip: true,
        tripData: t,
        unreadCount: t.unreadCount || 0,
        pinned: t.isPinned || false,
        muted: t.isMuted || false
      }));

      const combined = [...privateMatches, ...groupTrips];
      dispatch(setMatches(combined));
    } catch (e) {
      console.warn('[MatchesScreen] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dispatch]);

  const lastFetchRef = React.useRef(0);

  useEffect(() => {
    const onFocus = () => {
      userAPI.whoLikedMe().then(res => {
        dispatch(updateUser({ likesReceived: res.data.totalCount || 0 }));
      }).catch(() => {});
      
      // Throttle: only re-fetch from API if >30s since last fetch
      // This prevents overwriting real-time socket updates every time user switches tabs
      const now = Date.now();
      if (now - lastFetchRef.current > 30000) {
        fetchAllChats(false);
        lastFetchRef.current = now;
      }
    };

    const unsubscribe = navigation.addListener('focus', onFocus);
    fetchAllChats();  // Initial load
    lastFetchRef.current = Date.now();
    return unsubscribe;
  }, [navigation, fetchAllChats, dispatch]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const renderWhoLikedMeBanner = useCallback(() => {
    if (likesReceived <= 0) return null;
    
    return (
      <TouchableOpacity
        style={styles.likedBanner}
        onPress={() => navigation.navigate('WhoLikedMe')}
        activeOpacity={0.8}
      >
        <View style={styles.likedBannerIcon}>
          <Ionicons name="heart" size={28} color="#fff" />
        </View>
        <View style={styles.likedBannerText}>
          <Text style={styles.likedBannerTitle}>
            {likesReceived} {likesReceived === 1 ? 'person' : 'people'} liked you
          </Text>
          <Text style={styles.likedBannerSub}>
            Like them back to match instantly ✨
          </Text>
        </View>
        <View style={styles.likedBannerRight}>
          <View style={styles.likedBadge}>
            <Text style={styles.likedBadgeText}>
              {likesReceived > 99 ? '99+' : likesReceived}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
        </View>
      </TouchableOpacity>
    );
  }, [likesReceived, navigation]);

  const renderMatch = useCallback(({ item }: { item: any }) => {
    const isTrip = item.type === 'group';

    return (
      <TouchableOpacity
        style={[
          styles.matchItem,
          selectedMatch?.matchId === item.matchId && { backgroundColor: COLORS.borderLight }
        ]}
        onPress={() => {
          // Clear unread locally + in DB
          dispatch(setActiveChat(item.matchId));
          if (!isTrip) chatAPI.readChat(item.matchId).catch(() => {});

          if (isTrip) {
            navigation.navigate('Chat', {
              type: 'group',
              chatId: item.matchId,
              userName: item.user.firstName,
              userPhoto: item.user.profilePhoto,
              membersCount: item.tripData?.membersCount
            });
          } else {
            navigation.navigate('Chat', {
              type: 'individual',
              chatId: item.matchId,
              userName: item.user.firstName,
              userPhoto: item.user.profilePhoto,
              userId: item.user._id,
              isOnline: item.user.isOnline,
              activityStatus: item.user.activityStatus,
              lastSeen: item.user.lastSeen,
            });
          }
        }}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={300}
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrapper}>
          {isTrip ? (
            item.user.profilePhoto ? (
              <Image source={{ uri: item.user.profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: '#EDE7F6' }]}>
                <Text style={styles.avatarEmoji}>{item.tripData?.mode === 'flight' ? '✈️' : item.tripData?.mode === 'train' ? '🚂' : '🎒'}</Text>
              </View>
            )
          ) : item.user.profilePhoto ? (
            <Image source={{ uri: item.user.profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          {!isTrip && item.user.isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.matchInfo}>
          <View style={styles.matchRow}>
            <View style={styles.nameRow}>
              <Text style={styles.matchName} numberOfLines={1}>{item.user.firstName}</Text>
              {isTrip && (
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>Group</Text>
                </View>
              )}
              {!isTrip && item.user.isPhotoVerified && (
                <Ionicons name="checkmark-circle" size={14} color={COLORS.teal} />
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {(item.muted || item.isMuted) && <Ionicons name="notifications-off" size={12} color={COLORS.textLight} />}
              {(item.pinned || item.isPinned) && <Ionicons name="pin" size={12} color={COLORS.teal} />}
              <Text style={styles.matchTime}>
                {formatTime(item.lastMessage?.sentAt || item.matchedAt)}
              </Text>
            </View>
          </View>

          {isTrip ? (
            <Text style={[styles.lastMessage, { color: COLORS.teal, fontWeight: '600' }]} numberOfLines={1}>
              {item.tripData?.membersCount} members · {new Date(item.tripData?.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </Text>
          ) : item.user.city ? (
            <Text style={[styles.lastMessage, { color: COLORS.textLight, fontSize: 13 }]} numberOfLines={1}>
              📍 {item.user.city}{item.user.country ? `, ${item.user.country}` : ''}
              {item.distanceKm != null ? ` · ${item.distanceKm} km away` : ''}
            </Text>
          ) : null}

          <View style={styles.matchRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage ? (
                <>
                  {isTrip && <Text style={{ fontWeight: '700' }}>{item.lastMessage.senderName}: </Text>}
                  {item.lastMessage.text}
                </>
              ) : (
                isTrip ? 'Start the group conversation! 💬' : `Matched ${formatTime(item.matchedAt)} 🎉`
              )}
            </Text>
            {!!item.unreadCount && item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCountText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, selectedMatch, handleLongPress]);

  const handleAction = async (action: 'pin' | 'mute' | 'delete' | 'unread' | 'leave') => {
    if (!selectedMatch) return;
    const matchId = selectedMatch.matchId;
    const isTrip = selectedMatch.type === 'group';

    setIsSheetVisible(false);

    try {
      if (action === 'pin') {
        dispatch(togglePin(matchId));
        if (isTrip) await tripAPI.pinTrip(matchId);
        else await matchAPI.pinMatch(matchId);
      } else if (action === 'mute') {
        dispatch(toggleMute(matchId));
        if (isTrip) await tripAPI.muteTrip(matchId);
        else await matchAPI.muteMatch(matchId);
      } else if (action === 'delete') {
        dispatch(removeMatch(matchId));
        if (!isTrip) await matchAPI.unmatch(matchId);
        // Trips don't have a simple "delete" for user, they "leave" or "hide"
      } else if (action === 'unread') {
        // Just clear locally if we wanted to mark read, but user asked for "Mark as Unread"
        // For simplicity, we just toggle 1
        // dispatch(markUnread(matchId));
      } else if (action === 'leave') {
        dispatch(removeMatch(matchId));
        if (isTrip && currentUserId) {
          await tripAPI.leaveTrip(matchId, currentUserId);
        }
      }
    } catch (e) {
      console.error('[MatchesScreen] Action error:', e);
    }
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={COLORS.teal} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✈️ Matches</Text>
        <Text style={styles.headerCount}>{matches.length} connections</Text>
      </View>

      <FlatList
        data={sortedMatches}
        keyExtractor={(m) => m.matchId}
        renderItem={renderMatch}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
               setLoading(true); // show loader for full refresh
               fetchAllChats(true);
            }}
            tintColor={COLORS.teal}
          />
        }
        ListHeaderComponent={renderWhoLikedMeBanner}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏝️</Text>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptySubtitle}>
              Start discovering travelers to find your{'\n'}perfect trip partner!
            </Text>
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={() => navigation.navigate('Discover')}
            >
              <Text style={styles.discoverBtnText}>Start Discovering</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Custom WhatsApp-Style Bottom Sheet Modal */}
      <Modal
        visible={isSheetVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSheetVisible(false)}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setIsSheetVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {selectedMatch?.type === 'group' ? selectedMatch?.user?.firstName : `${selectedMatch?.user?.firstName} ${selectedMatch?.user?.lastName || ''}`}
              </Text>
            </View>

            <View style={styles.sheetList}>
              <TouchableOpacity 
                style={styles.sheetItem} 
                onPress={() => handleAction('pin')}
              >
                <View style={[styles.sheetIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons 
                    name={(selectedMatch?.pinned || selectedMatch?.isPinned) ? "push" : "push-outline"} 
                    size={20} 
                    color="#1976D2" 
                  />
                </View>
                <Text style={styles.sheetItemText}>
                  {(selectedMatch?.pinned || selectedMatch?.isPinned) ? 'Unpin Chat' : 'Pin Chat'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.sheetItem} 
                onPress={() => handleAction('mute')}
              >
                <View style={[styles.sheetIcon, { backgroundColor: '#F5F5F5' }]}>
                  <Ionicons 
                    name={(selectedMatch?.muted || selectedMatch?.isMuted) ? "notifications-off" : "notifications"} 
                    size={20} 
                    color="#424242" 
                  />
                </View>
                <Text style={styles.sheetItemText}>
                  {(selectedMatch?.muted || selectedMatch?.isMuted) ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              {selectedMatch?.type === 'group' && (
                <TouchableOpacity 
                  style={styles.sheetItem} 
                  onPress={() => {
                    setIsSheetVisible(false);
                    navigation.navigate('GroupDetails', { tripId: selectedMatch.matchId });
                  }}
                >
                  <View style={[styles.sheetIcon, { backgroundColor: '#E0F2F1' }]}>
                    <Ionicons name="information-circle" size={20} color="#00796B" />
                  </View>
                  <Text style={styles.sheetItemText}>View Details</Text>
                </TouchableOpacity>
              )}

              {selectedMatch?.type === 'group' && (
                <TouchableOpacity 
                  style={styles.sheetItem} 
                  onPress={() => handleAction('leave')}
                >
                  <View style={[styles.sheetIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="exit" size={20} color="#E65100" />
                  </View>
                  <Text style={[styles.sheetItemText, { color: '#E65100' }]}>Leave Trip</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.sheetItem} 
                onPress={() => handleAction('delete')}
              >
                <View style={[styles.sheetIcon, { backgroundColor: '#FFEBEE' }]}>
                  <Ionicons name="trash" size={20} color="#D32F2F" />
                </View>
                <Text style={[styles.sheetItemText, { color: '#D32F2F' }]}>
                  {selectedMatch?.type === 'group' ? 'Clear Chat' : 'Unmatch User'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: '800', color: COLORS.text },
  headerCount: { fontSize: FONTS.sm, color: COLORS.textLight, marginTop: 2 },
  likedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.teal,
    gap: 12,
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  likedBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedBannerText: { flex: 1 },
  likedBannerTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: FONTS.base,
    marginBottom: 2,
  },
  likedBannerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FONTS.xs,
  },
  likedBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likedBadge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  likedBadgeText: {
    color: COLORS.teal,
    fontSize: 11,
    fontWeight: '800',
  },
  list: { paddingBottom: 16 },
  matchItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: 14, gap: 14,
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarPlaceholder: {
    backgroundColor: COLORS.tealLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 24 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.success, borderWidth: 2, borderColor: COLORS.white,
  },
  matchInfo: { flex: 1 },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  matchName: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  matchTime: { fontSize: FONTS.xs, color: COLORS.textLight },
  lastMessage: { flex: 1, fontSize: FONTS.sm, color: COLORS.textSecondary, paddingRight: 8 },
  unreadBadge: {
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadCountText: { fontSize: 10, color: COLORS.white, fontWeight: '700' },
  groupBadge: {
    backgroundColor: COLORS.tealLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  groupBadgeText: {
    color: COLORS.tealDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  separator: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 86 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: FONTS.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  discoverBtn: {
    backgroundColor: COLORS.teal, borderRadius: RADIUS.full,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: 8,
  },
  discoverBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
  sheetItemText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    minHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  sheetList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});