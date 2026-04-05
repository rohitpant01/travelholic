import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated,
  Dimensions, ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchNotifications } from '../store/slices/notificationSlice';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { discoverAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import ShimmerPlaceholder from 'react-native-shimmer-placeholder';

// New Components
import DiscoveryHeader from '../components/DiscoveryHeader';
import TravelersMapView from '../components/TravelersMapView';
import TravelerPreviewSheet from '../components/TravelerPreviewSheet';
import TravelerDiscoveryCard, { Profile } from '../components/TravelerDiscoveryCard';

const { width: W, height: H } = Dimensions.get('window');

export default function DiscoverScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  const theme = useAppTheme();
  const styles = getStyles(theme);

  const { user } = useSelector((state: RootState) => state.auth);
  const { unreadCount } = useSelector((state: RootState) => state.notification);

  // Discovery State
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Map Interaction State
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [focusUserId, setFocusUserId] = useState<string | undefined>(undefined);

  // UI State
  const [matchPopup, setMatchPopup] = useState<{ name: string; photo?: string } | null>(null);
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);

  useEffect(() => {
    if (user && !user.isEmailVerified && (user.registrationStep || 0) >= 9) {
      setShowVerifyPopup(true);
    }
  }, [user?.isEmailVerified, user?.registrationStep]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        const lastLoc = await Location.getLastKnownPositionAsync();
        if (lastLoc) {
          lat = lastLoc.coords.latitude;
          lng = lastLoc.coords.longitude;
        } else {
          const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = currentLoc.coords.latitude;
          lng = currentLoc.coords.longitude;
        }
        if (lat && lng) setUserLocation({ latitude: lat, longitude: lng });
      }

      const res = await discoverAPI.getProfiles(lat, lng);
      setProfiles(res.data.profiles || []);
    } catch (e) {
      console.error('[FETCH PROFILES ERROR]', e);
      Alert.alert('Error', 'Could not load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    dispatch(fetchNotifications());
  }, []);

  const removeTop = () => setProfiles(p => p.slice(1));

  const handleLike = async () => {
    const top = profiles[0];
    if (!top) return;
    removeTop();
    try {
      const res = await discoverAPI.like(top._id);
      if (res.data.matched) {
        setMatchPopup({ name: res.data.matchedUser.firstName, photo: res.data.matchedUser.profilePhoto });
        setTimeout(() => setMatchPopup(null), 3500);
      }
    } catch (e) { }
  };

  const handleSkip = async () => {
    const top = profiles[0];
    if (!top) return;
    removeTop();
    try { await discoverAPI.skip(top._id); } catch (e) { }
  };

  const handleSuperLike = async () => {
    const top = profiles[0];
    if (!top) return;
    removeTop();
    try { await discoverAPI.superLike(top._id); } catch (e) { }
  };

  const handleMarkerPress = useCallback((user: Profile) => {
    setSelectedUser(user);
    setFocusUserId(user._id);
  }, []);

  const removeUserFromStack = useCallback((userId: string) => {
    setProfiles(prev => prev.filter(p => p._id !== userId));
  }, []);

  const handleViewOnMap = (userId: string) => {
    setViewMode('map');
    setFocusUserId(userId);
  };

  const renderShimmer = () => (
    <View style={styles.shimmerContainer}>
      <ShimmerPlaceholder style={styles.shimmerCard} />
      <View style={styles.shimmerActions}>
        <ShimmerPlaceholder style={styles.shimmerBtn} />
        <ShimmerPlaceholder style={styles.shimmerBtnSmall} />
        <ShimmerPlaceholder style={styles.shimmerBtn} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <DiscoveryHeader
        viewMode={viewMode}
        onToggle={setViewMode}
        onFilterPress={() => { }} // TODO: Connect filter
        unreadCount={unreadCount}
        onSavedPress={() => navigation.navigate('SavedDestinations')}
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />

      <View style={styles.contentArea}>
        {loading ? (
          renderShimmer()
        ) : profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyTitle}>Discover Travelers</Text>
            <Text style={styles.emptySubtitle}>No travelers nearby right now, but your journey is waiting.</Text>
            <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('AllDestinations')}>
              <Text style={styles.exploreBtnText}>Explore Destinations</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'list' ? (
          <View style={styles.listContainer}>
            <View style={styles.cardsStack}>
              {profiles.slice(0, 3).reverse().map((profile, index) => {
                const isTop = index === Math.min(profiles.length, 3) - 1;
                return (
                  <TravelerDiscoveryCard
                    key={profile._id}
                    profile={profile}
                    isTop={isTop}
                    onLike={handleLike}
                    onSkip={handleSkip}
                    onSuperLike={handleSuperLike}
                    onPressProfile={(p) => navigation.navigate('UserDetail', {
                      userId: p._id,
                      profile: p,
                      onActionPerformed: () => removeUserFromStack(p._id)
                    })}
                  />
                );
              })}
            </View>

            {/* Floating Actions overlay for List mode only */}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, styles.skipBtn]} onPress={handleSkip}>
                <Ionicons name="close" size={32} color={theme.error} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.superLikeBtn]} onPress={handleSuperLike}>
                <Ionicons name="star" size={28} color={theme.gold} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={handleLike}>
                <Ionicons name="heart" size={32} color={theme.teal} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.mapContainer}>
            <TravelersMapView
              profiles={profiles}
              userLocation={userLocation}
              onMarkerPress={handleMarkerPress}
              selectedUserId={focusUserId}
            />
          </View>
        )}
      </View>

      {/* Map Preview Sheet */}
      <TravelerPreviewSheet
        user={selectedUser}
        onClose={() => { setSelectedUser(null); setFocusUserId(undefined); }}
        onViewProfile={(p) => {
          setSelectedUser(null);
          navigation.navigate('UserDetail', {
            userId: p._id,
            profile: p,
            onActionPerformed: () => removeUserFromStack(p._id)
          });
        }}
      />

      {/* Match popup */}
      {matchPopup && (
        <View style={styles.matchOverlay}>
          <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🎉</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>You and {matchPopup.name} liked each other!</Text>
            <TouchableOpacity style={styles.matchChatBtn} onPress={() => { setMatchPopup(null); navigation.navigate('Matches'); }}>
              <Text style={styles.matchChatBtnText}>Start Chatting →</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* Email Verification Pop-up */}
      <Modal visible={showVerifyPopup} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.verifyPopupCard}>
            <View style={styles.verifyIconCircle}>
              <Ionicons name="mail-unread" size={32} color={theme.teal} />
            </View>
            <Text style={styles.verifyTitle}>Verify Your Email</Text>
            <Text style={styles.verifyDesc}>Please verify your email to unlock all features.</Text>
            <TouchableOpacity style={styles.verifyBtn} onPress={() => { setShowVerifyPopup(false); navigation.navigate('EditProfile'); }}>
              <Text style={styles.verifyBtnText}>Verify Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.laterBtn} onPress={() => setShowVerifyPopup(false)}>
              <Text style={styles.laterBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  contentArea: { flex: 1 },
  listContainer: { flex: 1 },
  mapContainer: { flex: 1 },
  cardsStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 30, // Start cards from the top area
  },

  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 24, paddingHorizontal: 40, gap: 20,
    backgroundColor: 'transparent',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  actionBtn: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center',
    justifyContent: 'center', backgroundColor: theme.card, ...SHADOW.lg,
  },
  skipBtn: { borderWidth: 1, borderColor: theme.error + '40' },
  likeBtn: { borderWidth: 1, borderColor: theme.teal + '40' },
  superLikeBtn: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: theme.gold + '40' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 12 },
  emptyTitle: { fontSize: FONTS.xl, fontWeight: '800', color: theme.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  exploreBtn: { backgroundColor: theme.teal, borderRadius: RADIUS.full, paddingHorizontal: 28, paddingVertical: 14, ...SHADOW.md },
  exploreBtnText: { color: theme.textWhite, fontWeight: '800', fontSize: 15 },

  shimmerContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', padding: 16, paddingTop: 30 },
  shimmerCard: { width: W - 32, height: H * 0.6, borderRadius: 24, marginBottom: 40 },
  shimmerActions: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  shimmerBtn: { width: 66, height: 66, borderRadius: 33 },
  shimmerBtnSmall: { width: 54, height: 54, borderRadius: 27 },

  matchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  matchCard: { width: W - 60, borderRadius: 28, padding: 32, alignItems: 'center', gap: 12 },
  matchEmoji: { fontSize: 60 },
  matchTitle: { fontSize: FONTS.xxxl, fontWeight: '900', color: theme.textWhite },
  matchSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  matchChatBtn: { backgroundColor: theme.white, borderRadius: RADIUS.full, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8 },
  matchChatBtnText: { color: theme.teal, fontWeight: '800', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  verifyPopupCard: { backgroundColor: theme.card, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', ...SHADOW.lg },
  verifyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.tealLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  verifyTitle: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 8 },
  verifyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  verifyBtn: { backgroundColor: theme.teal, width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  verifyBtnText: { color: theme.textWhite, fontSize: 16, fontWeight: '700' },
  laterBtn: { paddingVertical: 8 },
  laterBtnText: { color: theme.textLight, fontSize: 14, fontWeight: '600' },
});
