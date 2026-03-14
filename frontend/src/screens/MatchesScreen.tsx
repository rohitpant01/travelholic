import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { matchAPI } from '../api/services';
import { setUnreadCounts } from '../store/slices/chatSlice';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

interface Match {
  matchId: string;
  user: {
    _id: string;
    firstName: string;
    profilePhoto?: string;
    isOnline?: boolean;
    age?: number;
    city?: string;
    country?: string;
    isPhotoVerified?: boolean;
  };
  lastMessage?: { text: string; sentAt: string; sentBy: string };
  unreadCount?: number;
  distanceKm?: number | null;
  matchedAt: string;
}

export default function MatchesScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await matchAPI.getMatches();
      const data = res.data.matches;
      setMatches(data);
      // Sync unread counts to Redux for the tab badge
      dispatch(setUnreadCounts(
        data.map((m: Match) => ({ matchId: m.matchId, count: m.unreadCount || 0 }))
      ));
    } catch (e) {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchMatches(); }, []);

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

  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => navigation.navigate('Chat', {
        matchId: item.matchId,
        userName: item.user.firstName,
        userPhoto: item.user.profilePhoto,
        userId: item.user._id,
      })}
      activeOpacity={0.75}
    >
      <View style={styles.avatarWrapper}>
        {item.user.profilePhoto ? (
          <Image source={{ uri: item.user.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarEmoji}>✈️</Text>
          </View>
        )}
        {item.user.isOnline && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.matchInfo}>
        <View style={styles.matchRow}>
          <View style={styles.nameRow}>
            <Text style={styles.matchName}>{item.user.firstName}</Text>
            {item.user.isPhotoVerified && (
              <Ionicons name="checkmark-circle" size={14} color={COLORS.teal} />
            )}
          </View>
          <Text style={styles.matchTime}>
            {formatTime(item.lastMessage?.sentAt || item.matchedAt)}
          </Text>
        </View>
          {item.user.city && <Text style={[styles.lastMessage, { color: COLORS.textLight }]} numberOfLines={1}>
            📍 {item.user.city}{item.user.country ? `, ${item.user.country}` : ''}{item.distanceKm != null ? ` · ${item.distanceKm} km away` : ''}
          </Text>}
        <View style={styles.matchRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage?.text || `Matched ${formatTime(item.matchedAt)} 🎉`}
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

      {matches.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💫</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtitle}>
            Start swiping on the Discover tab to find your travel companion!
          </Text>
          <TouchableOpacity
            style={styles.discoverBtn}
            onPress={() => navigation.navigate('Discover')}
          >
            <Text style={styles.discoverBtnText}>Start Discovering →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={item => item.matchId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchMatches(true)}
              tintColor={COLORS.teal} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  list: { paddingVertical: 8 },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchName: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
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
});
