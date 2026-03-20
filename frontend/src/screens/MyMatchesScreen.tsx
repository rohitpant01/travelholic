import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { matchAPI } from '../api/services';
import { COLORS, FONTS, SHADOW, RADIUS, SPACING } from '../utils/theme';

interface Match {
  matchId: string;
  user: {
    _id: string;
    firstName: string;
    profilePhoto?: string;
    age?: number;
    city?: string;
    country?: string;
  };
  matchedAt: string;
}

export default function MyMatchesScreen() {
  const navigation = useNavigation<any>();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await matchAPI.getMatches();
      // Filter only private matches (exclude groups if they appear in this endpoint)
      const privateMatches = res.data.matches.filter((m: any) => !m.isTrip);
      setMatches(privateMatches);
    } catch (error) {
      console.error('[MyMatchesScreen] fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const renderMatchItem = ({ item }: { item: Match }) => {
    const { user } = item;
    return (
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => navigation.navigate('UserDetail', { userId: user._id })}
        activeOpacity={0.8}
      >
        {user.profilePhoto ? (
          <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
        )}
        <View style={styles.matchInfo}>
          <Text style={styles.userName}>{user.firstName}{user.age ? `, ${user.age}` : ''}</Text>
          <Text style={styles.location}>
            {user.city || 'Unknown'}{user.country ? `, ${user.country}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Matches</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.matchId}
        renderItem={renderMatchItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchMatches(true)} tintColor={COLORS.teal} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-dislike-outline" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No matches yet. Keep discovering!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    ...SHADOW.sm,
  },
  backBtn: { padding: 5, marginRight: 15 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  listContent: { padding: 20 },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    ...SHADOW.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.border },
  avatarPlaceholder: { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 24 },
  matchInfo: { flex: 1, marginLeft: 15 },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  location: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 15, textAlign: 'center' },
});
