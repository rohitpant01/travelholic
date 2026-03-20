import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
  Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS } from '../utils/theme';
import { userAPI } from '../api/services';
import { updateUser } from '../store/slices/authSlice';
import { RootState } from '../store';
import { discoverAPI } from '../api/services';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 48 - CARD_GAP) / 2;

interface Liker {
  _id: string;
  firstName: string;
  lastName: string;
  age?: number;
  city?: string;
  country?: string;
  photo: string | null;
  bio?: string;
  interests?: string[];
  isPhotoVerified: boolean;
  origin?: { city: string };
  destination?: { city: string };
  travelDate?: string;
}

type LikeState = 'idle' | 'loading' | 'liked' | 'skipped';

export default function WhoLikedMeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const currentLikesReceived = useSelector((s: RootState) => s.auth.user?.likesReceived ?? 0);

  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likeStates, setLikeStates] = useState<Record<string, LikeState>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchLikers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await userAPI.whoLikedMe();
      const fetched: Liker[] = res.data.likedBy || [];
      setLikers(fetched);

      // Sync Redux likesReceived with real server count on load/refresh
      dispatch(updateUser({ likesReceived: fetched.length }));
    } catch (e: any) {
      setError('Could not load likes. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLikers();
  }, []);

  // Decrement Redux likesReceived immediately so MatchesScreen banner stays in sync
  const decrementLikesCount = () => {
    dispatch(updateUser({ likesReceived: Math.max(0, currentLikesReceived - 1) }));
  };

  const handleLikeBack = async (liker: Liker) => {
    setLikeStates(prev => ({ ...prev, [liker._id]: 'loading' }));
    try {
      await userAPI.likeBack(liker._id);
      setLikeStates(prev => ({ ...prev, [liker._id]: 'liked' }));
      decrementLikesCount();

      setTimeout(() => {
        setLikers(prev => prev.filter(l => l._id !== liker._id));
        setLikeStates(prev => { const s = { ...prev }; delete s[liker._id]; return s; });
      }, 700);
    } catch {
      setLikeStates(prev => ({ ...prev, [liker._id]: 'idle' }));
      Alert.alert('Error', 'Could not like back. Please try again.');
    }
  };

  const handleSkip = async (likerId: string) => {
    // Optimistic UI
    setLikeStates(prev => ({ ...prev, [likerId]: 'skipped' }));
    decrementLikesCount();

    try {
      // Backend persistence
      await discoverAPI.skip(likerId);
      
      setTimeout(() => {
        setLikers(prev => prev.filter(l => l._id !== likerId));
        setLikeStates(prev => { const s = { ...prev }; delete s[likerId]; return s; });
      }, 350);
    } catch (e) {
      console.error('[SKIP ERROR]', e);
      // Even if it fails, we keep it hidden from current session for better UX
      setTimeout(() => {
        setLikers(prev => prev.filter(l => l._id !== likerId));
        setLikeStates(prev => { const s = { ...prev }; delete s[likerId]; return s; });
      }, 350);
    }
  };

  const renderCard = useCallback(({ item }: { item: Liker }) => {
    const state = likeStates[item._id] || 'idle';
    const isProcessing = state === 'loading';
    const isLiked = state === 'liked';

    return (
      <View style={[styles.card, isLiked && styles.cardLiked]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('UserDetail', { userId: item._id })}
        >
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="person" size={40} color={COLORS.textLight} />
            </View>
          )}
          {item.isPhotoVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#fff" />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.firstName}{item.age ? `, ${item.age}` : ''}
            </Text>
            {(item.city || item.country) && (
              <Text style={styles.cardLocation} numberOfLines={1}>
                {[item.city, item.country].filter(Boolean).join(', ')}
              </Text>
            )}
            {item.destination?.city && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <Ionicons name="airplane" size={10} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                  {item.destination.city}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnSkip, (isProcessing || isLiked) && styles.btnDisabled]}
            onPress={() => handleSkip(item._id)}
            disabled={isProcessing || isLiked}
          >
            <Ionicons name="close" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnLike, isLiked && styles.btnLiked, isProcessing && styles.btnDisabled]}
            onPress={() => handleLikeBack(item)}
            disabled={isProcessing || isLiked}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : isLiked ? (
              <Ionicons name="checkmark" size={18} color="#fff" />
            ) : (
              <Ionicons name="heart" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [likeStates, navigation]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="heart-outline" size={56} color={COLORS.teal} />
      </View>
      <Text style={styles.emptyTitle}>You're all caught up!</Text>
      <Text style={styles.emptySubtitle}>
        You've responded to everyone. New likes will appear here when they arrive.
      </Text>
    </View>
  );

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0) }
    ]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Who Liked Me</Text>
          {likers.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{likers.length}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.loaderText}>Loading likes…</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wifi-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchLikers()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={item => item._id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={likers.length > 0 ? styles.row : undefined}
          contentContainerStyle={[
            styles.listContent,
            likers.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchLikers(true)}
              tintColor={COLORS.teal}
              colors={[COLORS.teal]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.3 },
  countBadge: {
    backgroundColor: COLORS.teal, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  listContent: { padding: 16, paddingBottom: 32 },
  listContentEmpty: { flexGrow: 1 },
  row: { justifyContent: 'space-between', marginBottom: CARD_GAP },
  card: {
    width: CARD_WIDTH, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardLiked: { borderWidth: 2, borderColor: COLORS.teal },
  photo: { width: '100%', height: CARD_WIDTH * 1.25, backgroundColor: '#e9ecef' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 8,
  },
  cardName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardLocation: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  verifiedBadge: {
    position: 'absolute', top: 8, right: 8, backgroundColor: COLORS.teal,
    borderRadius: 10, width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff',
  },
  actions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', gap: 8,
  },
  btnSkip: {
    flex: 1, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e9ecef',
  },
  btnLike: {
    flex: 1, height: 36, borderRadius: 18,
    backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center',
  },
  btnLiked: { backgroundColor: '#22c55e' },
  btnDisabled: { opacity: 0.5 },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: COLORS.textLight, fontSize: 14 },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12,
  },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#e6f7f6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 28, paddingVertical: 12,
    backgroundColor: COLORS.teal, borderRadius: 24,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});