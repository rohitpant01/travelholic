import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder,
  Dimensions, Image, ActivityIndicator, Alert
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { discoverAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

const { width: W, height: H } = Dimensions.get('window');
const CARD_WIDTH = W - 32;
const SWIPE_THRESHOLD = W * 0.3;

interface Profile {
  _id: string;
  firstName: string;
  lastName?: string;
  age?: number;
  gender?: string;
  bio?: string;
  photos?: any[];
  interests?: string[];
  location?: { city?: string; country?: string };
  isPhotoVerified?: boolean;
  distanceKm?: number;
  lookingFor?: string[];
}

function TravelerCard({ profile, onLike, onSkip, onSuperLike, isTop }: {
  profile: Profile;
  onLike: () => void;
  onSkip: () => void;
  onSuperLike: () => void;
  isTop: boolean;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [photoIndex, setPhotoIndex] = useState(0);
  const profilePhoto = profile.photos?.find(p => p.isProfile)?.url || profile.photos?.[0]?.url;

  const rotate = pan.x.interpolate({
    inputRange: [-W / 2, 0, W / 2],
    outputRange: ['-15deg', '0deg', '15deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, W * 0.2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const skipOpacity = pan.x.interpolate({
    inputRange: [-W * 0.2, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const superlikeOpacity = pan.y.interpolate({
    inputRange: [-H * 0.2, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: W * 1.5, y: gesture.dy },
            duration: 250, useNativeDriver: false,
          }).start(onLike);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: -W * 1.5, y: gesture.dy },
            duration: 250, useNativeDriver: false,
          }).start(onSkip);
        } else if (gesture.dy < -SWIPE_THRESHOLD * 0.8) {
          Animated.timing(pan, {
            toValue: { x: gesture.dx, y: -H },
            duration: 250, useNativeDriver: false,
          }).start(onSuperLike);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const photos = profile.photos || [];

  return (
    <Animated.View
      style={[
        styles.card,
        isTop && {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
        },
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {/* Photo */}
      <View style={styles.photoContainer}>
        {profilePhoto ? (
          <Image source={{ uri: photos[photoIndex]?.url || profilePhoto }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <Text style={{ fontSize: 64 }}>✈️</Text>
          </View>
        )}

        {/* Photo navigation dots */}
        {photos.length > 1 && (
          <View style={styles.dotRow}>
            {photos.map((_: any, i: number) => (
              <TouchableOpacity key={i} onPress={() => setPhotoIndex(i)}>
                <View style={[styles.photoDot, photoIndex === i && styles.photoDotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Photo navigation tap zones */}
        <TouchableOpacity
          style={styles.prevPhotoZone}
          onPress={() => setPhotoIndex(i => Math.max(0, i - 1))}
        />
        <TouchableOpacity
          style={styles.nextPhotoZone}
          onPress={() => setPhotoIndex(i => Math.min(photos.length - 1, i + 1))}
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={styles.photoOverlay}
        />

        {/* Like/Skip/SuperLike indicators */}
        {isTop && (
          <>
            <Animated.View style={[styles.swipeLabel, styles.likeLabelPos, { opacity: likeOpacity }]}>
              <Text style={styles.likeLabel}>LIKE 💚</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeLabel, styles.skipLabelPos, { opacity: skipOpacity }]}>
              <Text style={styles.skipLabel}>SKIP ✕</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeLabel, styles.superLikeLabelPos, { opacity: superlikeOpacity }]}>
              <Text style={styles.superLikeLabel}>SUPER ⭐</Text>
            </Animated.View>
          </>
        )}

        {/* Verified badge */}
        {profile.isPhotoVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}

        {/* Profile info overlay */}
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName}>{profile.firstName}</Text>
            {profile.age && <Text style={styles.cardAge}>{profile.age}</Text>}
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.cardLocation}>
              {profile.location?.city || 'Unknown'}{profile.distanceKm ? ` · ${profile.distanceKm} km` : ''}
            </Text>
          </View>
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interestRow}>
              {profile.interests.slice(0, 3).map(i => (
                <View key={i} style={styles.interestBadge}>
                  <Text style={styles.interestBadgeText}>{i}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function DiscoverScreen() {
  const navigation = useNavigation<any>();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchPopup, setMatchPopup] = useState<{ name: string; photo?: string } | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      
      const res = await discoverAPI.getProfiles(lat, lng);
      setProfiles(res.data.profiles);
    } catch (e) {
      Alert.alert('Error', 'Could not load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

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
    } catch (e) {}
  };

  const handleSkip = async () => {
    const top = profiles[0];
    if (!top) return;
    removeTop();
    try { await discoverAPI.skip(top._id); } catch (e) {}
  };

  const handleSuperLike = async () => {
    const top = profiles[0];
    if (!top) return;
    removeTop();
    try { await discoverAPI.superLike(top._id); } catch (e) {}
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>✈️</Text>
          <Text style={styles.logoText}>Discover</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="options-outline" size={26} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Cards area */}
      <View style={styles.cardsArea}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.teal} />
        ) : profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyTitle}>No more travelers nearby</Text>
            <Text style={styles.emptySubtitle}>Try increasing your discovery distance in settings</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchProfiles}>
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          profiles.slice(0, 3).reverse().map((profile, index) => {
            const isTop = index === profiles.slice(0, 3).length - 1;
            return (
              <TravelerCard
                key={profile._id}
                profile={profile}
                isTop={isTop}
                onLike={handleLike}
                onSkip={handleSkip}
                onSuperLike={handleSuperLike}
              />
            );
          })
        )}
      </View>

      {/* Action buttons */}
      {profiles.length > 0 && !loading && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.skipBtn]} onPress={handleSkip}>
            <Ionicons name="close" size={32} color={COLORS.error} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.superLikeBtn]} onPress={handleSuperLike}>
            <Ionicons name="star" size={28} color={COLORS.gold} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={handleLike}>
            <Ionicons name="heart" size={32} color={COLORS.teal} />
          </TouchableOpacity>
        </View>
      )}

      {/* Match popup */}
      {matchPopup && (
        <View style={styles.matchOverlay}>
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🎉</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>You and {matchPopup.name} liked each other!</Text>
            <TouchableOpacity
              style={styles.matchChatBtn}
              onPress={() => { setMatchPopup(null); navigation.navigate('Matches'); }}
            >
              <Text style={styles.matchChatBtnText}>Start Chatting →</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: 56, paddingBottom: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoEmoji: { fontSize: 24 },
  logoText: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text },
  cardsArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 16, paddingHorizontal: 16,
  },
  card: {
    position: 'absolute', width: CARD_WIDTH, height: H * 0.58,
    borderRadius: 24, overflow: 'hidden',
    ...SHADOW.lg,
  },
  photoContainer: { flex: 1 },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  noPhoto: { backgroundColor: COLORS.tealLight, alignItems: 'center', justifyContent: 'center' },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
  },
  prevPhotoZone: { position: 'absolute', left: 0, top: 0, width: '33%', height: '80%' },
  nextPhotoZone: { position: 'absolute', right: 0, top: 0, width: '67%', height: '80%' },
  dotRow: {
    position: 'absolute', top: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  photoDotActive: { backgroundColor: COLORS.white, width: 18 },
  swipeLabel: { position: 'absolute', padding: 8, borderWidth: 3, borderRadius: 8 },
  likeLabelPos: { top: 40, left: 20, borderColor: COLORS.teal, transform: [{ rotate: '-15deg' }] },
  skipLabelPos: { top: 40, right: 20, borderColor: COLORS.error, transform: [{ rotate: '15deg' }] },
  superLikeLabelPos: { top: 40, alignSelf: 'center', left: '30%', borderColor: COLORS.gold },
  likeLabel: { fontSize: FONTS.xl, fontWeight: '900', color: COLORS.teal },
  skipLabel: { fontSize: FONTS.xl, fontWeight: '900', color: COLORS.error },
  superLikeLabel: { fontSize: FONTS.xl, fontWeight: '900', color: COLORS.gold },
  verifiedBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.teal, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  verifiedText: { color: COLORS.white, fontSize: FONTS.xs, fontWeight: '700' },
  cardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  cardName: { fontSize: FONTS.xxl, fontWeight: '800', color: COLORS.white },
  cardAge: { fontSize: FONTS.xl, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardLocation: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)' },
  interestRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  interestBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  interestBadgeText: { color: COLORS.white, fontSize: FONTS.xs, fontWeight: '600' },
  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 40, gap: 20,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  actionBtn: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.white, ...SHADOW.md,
  },
  skipBtn: { borderWidth: 2, borderColor: COLORS.error },
  likeBtn: { borderWidth: 2, borderColor: COLORS.teal },
  superLikeBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: COLORS.gold },
  emptyState: { alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: FONTS.xl, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: FONTS.sm, color: COLORS.textSecondary, textAlign: 'center' },
  refreshBtn: {
    backgroundColor: COLORS.teal, borderRadius: RADIUS.full,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  refreshBtnText: { color: COLORS.white, fontWeight: '700' },
  matchOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  matchCard: {
    width: W - 60, borderRadius: 28, padding: 32, alignItems: 'center', gap: 12,
  },
  matchEmoji: { fontSize: 60 },
  matchTitle: { fontSize: FONTS.xxxl, fontWeight: '900', color: COLORS.white },
  matchSubtitle: { fontSize: FONTS.base, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  matchChatBtn: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.full,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: 8,
  },
  matchChatBtnText: { color: COLORS.teal, fontWeight: '800', fontSize: FONTS.base },
});
