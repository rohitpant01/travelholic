import React, { useEffect, useState, useRef } from 'react';
import {
  Pressable,
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, Platform, Modal, Alert, Share
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchUserPosts,
  clearUserPosts,
  Post
} from '../store/slices/feedSlice';
import { userAPI, discoverAPI, matchAPI } from '../api/services';
import { updateUser } from '../store/slices/authSlice';
import { useAppTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import TravelPostCard from '../components/TravelPostCard';
import PostCommentsModal from '../components/PostCommentsModal';
import PostLikesModal from '../components/PostLikesModal';
import WebDownloadBanner from '../components/WebDownloadBanner';

const { width: W } = Dimensions.get('window');



const formatLastSeen = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return 'Online now';
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  return `Last seen on ${d.toLocaleDateString()}`;
};

const INTEREST_EMOJIS: Record<string, string> = {
  'Adventure': '🧗', 'Nature': '🏔️', 'Culture': '🕌', 'Foodie': '🍜',
  'Nightlife': '🎉', 'Photography': '📸', 'Sustainable': '🌿', 'Luxury': '✨',
  'Budget': '🎒', 'Solo': '🚶', 'History': '🏰', 'Beach': '🏖️',
  'Mountains': '⛰️', 'Road Trips': '🚗', 'Hiking': '👣', 'Shopping': '🛍️',
  'Wellness': '🧘', 'Festivals': '🎭', 'Art': '🎨', 'Cities': '🏙️',
  'Sports': '⚽', 'Music': '🎸', 'Backpacking': '🎒'
};

export default function UserDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const { userId } = route.params || {};

  const { user: currentUser, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { userPosts, loading: loadingPosts } = useSelector((state: RootState) => state.feed);
  const matches = useSelector((s: RootState) => s.chat.matches);
  const dispatch = useDispatch<AppDispatch>();
  const [profile, setProfile] = useState<any>(route.params?.profile || null);
  const [loading, setLoading] = useState(!route.params?.profile);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showTrips, setShowTrips] = useState(false);
  const [isLiked, setIsLiked] = useState(currentUser?.likes?.includes(userId) || false);

  // Post Interaction States
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const commentsModalRef = React.useRef<any>(null);
  const likesModalRef = React.useRef<any>(null);

  useEffect(() => {
    if (userId) {
      loadProfile();
      dispatch(fetchUserPosts({ userId, page: 1 }));
      setIsLiked(currentUser?.likes?.includes(userId) || false);
    }
    return () => {
      dispatch(clearUserPosts());
    };
  }, [userId, currentUser?.likes]);

  const loadProfile = async () => {
    try {
      const res = await userAPI.getUserById(userId);
      setProfile(res.data.user);
    } catch (err) {
      console.error('Load profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isMatched = matches.some(m => String(m.user?._id) === String(userId));
  const isMe = String(userId) === String(currentUser?._id);

  const handleMessage = () => {
    const existingMatch = matches.find(m => String(m.user?._id) === String(userId));

    navigation.navigate('Chat', {
      type: 'individual',
      chatId: existingMatch?.matchId || null,
      userId,
      userName: `${profile.firstName} ${profile.lastName}`,
      userPhoto: profile.photos?.find((p: any) => p.isProfile)?.url || profile.photos?.[0]?.url,
    });
  };

  const handleLike = async () => {
    try {
      // 🚀 Optimistic update
      setIsLiked(true);
      if (currentUser) {
        const newLikes = [...(currentUser.likes || []), userId];
        dispatch(updateUser({ likes: newLikes }));
      }

      const res = await discoverAPI.like(userId);
      // Synchronize Discovery state
      if (route.params?.onActionPerformed) {
        route.params.onActionPerformed();
      }

      if (res.data.match) {
        Alert.alert("It's a Match! 🎉", `You and ${profile.firstName} have matched!`, [
          { text: "Message", onPress: handleMessage },
          { text: "Great!", onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert("Liked! ❤️", `We've let ${profile.firstName} know you're interested.`, [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      }
    } catch (e) {
      console.error('Like error:', e);
      setIsLiked(currentUser?.likes?.includes(userId) || false);
    }
  };

  const handlePass = async () => {
    try {
      await discoverAPI.skip(userId);
      // Synchronize Discovery state
      if (route.params?.onActionPerformed) {
        route.params.onActionPerformed();
      }
      navigation.goBack();
    } catch (e) {
      console.error('Pass error:', e);
    }
  };

  const INTEREST_EMOJIS: Record<string, string> = {
    Mountains: '🏔️', Beaches: '🏖️', 'Road Trips': '🚗', Trekking: '🥾',
    Camping: '⛺', Photography: '📸', 'Food Travel': '🍜', 'Cultural Travel': '🏛️',
    'Adventure Sports': '🪂', Backpacking: '🎒', 'Solo Travel': '🧍', Cruises: '🚢',
  };

  const renderFooter = () => {
    if (isMe || !isAuthenticated) return null;

    return (
      <View style={styles.footer}>
        <LinearGradient
          colors={['transparent', theme.mode === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255,255,255,0.95)', theme.background]}
          style={styles.footerGradient}
        />
        <View style={styles.actionRow}>
          {isMatched ? (
            <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
              <LinearGradient
                colors={[theme.teal, theme.tealDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.messageBtnGradient}
              >
                <Ionicons name="chatbubble-ellipses" size={22} color={theme.textWhite} />
                <Text style={styles.messageBtnText}>Message Traveler</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : isLiked ? (
            <View style={[styles.messageBtn, { opacity: 0.8 }]}>
              <View style={[styles.messageBtnGradient, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.teal }]}>
                <Ionicons name="checkmark-circle" size={24} color={theme.teal} />
                <Text style={[styles.messageBtnText, { color: theme.teal }]}>Request Sent</Text>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.secondaryActionBtn, { backgroundColor: theme.error }]}
                onPress={handlePass}
              >
                <Ionicons name="close" size={28} color={theme.textWhite} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.messageBtn} onPress={handleLike}>
                <LinearGradient
                  colors={[theme.teal, theme.tealDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.messageBtnGradient}
                >
                  <Ionicons name="heart" size={24} color={theme.textWhite} />
                  <Text style={styles.messageBtnText}>Connect</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={theme.teal} />
    </View>
  );

  if (!profile) return (
    <View style={styles.loader}>
      <Text style={{ color: theme.textSecondary }}>Profile not found</Text>
    </View>
  );

  const photos = profile.photos || [];
  const profilePhoto = photos.find((p: any) => p.isProfile)?.url || photos[0]?.url;

  return (
    <View style={styles.mainWrapper}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero */}
        <View style={[styles.hero, { height: 500 + insets.top }]}>
          {profilePhoto ? (
            <Image source={{ uri: photos[photoIndex]?.url || profilePhoto }} style={styles.heroPhoto} />
          ) : (
            <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.heroPhoto}>
              <Text style={{ fontSize: 80 }}>✈️</Text>
            </LinearGradient>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.85)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Photo navigation tap zones */}
          <View style={styles.tapZones}>
            <TouchableOpacity
              style={styles.tapZone}
              onPress={() => setPhotoIndex(i => Math.max(0, i - 1))}
            />
            <TouchableOpacity
              style={styles.tapZone}
              onPress={() => setPhotoIndex(i => Math.min(photos.length - 1, i + 1))}
            />
          </View>

          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 12 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color={theme.textWhite} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareBtn, { top: insets.top + 12 }]}
            onPress={async () => {
              const shareUrl = `https://ekalgo.com/user/${userId}`;
              try {
                await Share.share({
                  title: `EkalGo: ${profile.firstName}'s Profile`,
                  message: `Check out ${profile.firstName} on EkalGo! 🌍✨ They are a traveler from ${profile.location?.city || 'the world'}.\n\nView Profile: ${shareUrl}`,
                  url: shareUrl,
                });
              } catch (e) { }
            }}
          >
            <Ionicons name="share-outline" size={24} color={theme.textWhite} />
          </TouchableOpacity>

          {photos.length > 1 && (
            <View style={[styles.dots, { top: insets.top + 20 }]}>
              {photos.map((_: any, i: number) => (
                <View key={i} style={[styles.dot, photoIndex === i && styles.dotActive]} />
              ))}
            </View>
          )}

          <View style={styles.heroInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.heroName}>{profile.firstName} {profile.lastName}, {profile.age}</Text>
              {profile.isPhotoVerified && (
                <Ionicons name="checkmark-circle" size={22} color={theme.teal} style={{ marginLeft: 6 }} />
              )}
            </View>

            <View style={styles.statusRow}>
              {profile.isOnline ? (
                <View style={[styles.statusBadge, { backgroundColor: theme.success }]}>
                  <Text style={styles.statusBadgeText}>ACTIVE NOW</Text>
                </View>
              ) : (
                <Text style={styles.lastSeenText}>{formatLastSeen(profile.lastSeen)}</Text>
              )}
              <View style={styles.locationTag}>
                <Ionicons name="location" size={14} color={theme.textWhite} />
                <Text style={styles.locationText}>
                  {profile.location?.city || profile.city || 'Traveler'} · {profile.distanceKm || '0'}km
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* ✨ Web Nudge Banner */}
          <WebDownloadBanner id={userId} type="user" />

          {/* Social Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => setShowTrips(true)}>
              <Text style={styles.statNumber}>{profile.tripsCompleted || 0}</Text>
              <Text style={styles.statLabel}>Trips Completed</Text>
            </TouchableOpacity>
            <View style={[styles.statItem, styles.statDivider]}>
              <Text style={styles.statNumber}>{profile.matchesCount || 0}</Text>
              <Text style={styles.statLabel}>Total Matches</Text>
            </View>
            <View style={styles.statItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons
                  name={profile.memberStatus === 'Elite' ? 'crown' : profile.memberStatus === 'Premium' ? 'star' : 'account-check'}
                  size={16}
                  color={profile.memberStatus === 'Elite' ? theme.gold : profile.memberStatus === 'Premium' ? theme.teal : theme.textSecondary}
                />
                <Text style={[styles.statNumber, { fontSize: 16 }]}>{profile.memberStatus || 'Free'}</Text>
              </View>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>
              {profile.bio || `Passionate traveler exploring the world. Let's connect and plan our next adventure together! 🌎`}
            </Text>
          </View>

          {/* Travel Plan Card */}
          {(profile.destination?.city || profile.origin?.city) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Expedition</Text>
              <LinearGradient
                colors={[theme.tealLight, theme.mode === 'dark' ? 'rgba(0, 180, 180, 0.05)' : 'rgba(230, 246, 245, 0.5)']}
                style={styles.travelCard}
              >
                <View style={styles.travelTimeline}>
                  <View style={styles.timelineNode}>
                    <Ionicons name="radio-button-on" size={16} color={theme.teal} />
                    <View style={styles.timelineLine} />
                    <Ionicons name="airplane" size={18} color={theme.teal} style={{ marginVertical: 4 }} />
                    <View style={styles.timelineLine} />
                    <Ionicons name="location" size={18} color={theme.orange} />
                  </View>
                  <View style={styles.timelineContent}>
                    <View>
                      <Text style={styles.travelLabel}>Origin</Text>
                      <Text style={styles.travelValue}>{profile.origin?.city || 'Not specified'}</Text>
                    </View>
                    <View style={{ marginTop: 24 }}>
                      <Text style={styles.travelLabel}>Destination</Text>
                      <Text style={styles.travelValue}>{profile.destination?.city || 'Exploring...'}</Text>
                    </View>
                  </View>
                  <View style={styles.travelDateBox}>
                    <Text style={styles.dateMonth}>
                      {profile.travelDate ? new Date(profile.travelDate).toLocaleString('default', { month: 'short' }) : '---'}
                    </Text>
                    <Text style={styles.dateDay}>
                      {profile.travelDate ? new Date(profile.travelDate).getDate() : '--'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Interests */}
          {profile.interests?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Travel Styles</Text>
              <View style={styles.chipRow}>
                {profile.interests.map((i: string) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipEmoji}>{INTEREST_EMOJIS[i] || '✈️'}</Text>
                    <Text style={styles.chipLabel}>{i}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Traveler's Moments Section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Traveler's Moments</Text>
            {loadingPosts && userPosts.length === 0 ? (
              <ActivityIndicator color={theme.teal} style={{ marginTop: 20 }} />
            ) : userPosts.length > 0 ? (
              <View style={{ gap: 20 }}>
                {userPosts.map((post) => (
                  <TravelPostCard
                    key={post._id}
                    post={post}
                    onPressProfile={() => { }} // Already on user profile
                    onPressComment={(id) => {
                      setSelectedPostId(id);
                      commentsModalRef.current?.present();
                    }}
                    onPressLikes={(id) => {
                      setSelectedPostId(id);
                      likesModalRef.current?.present();
                    }}
                  />
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40, backgroundColor: theme.card, borderRadius: 20 }}>
                <Ionicons name="images-outline" size={40} color={theme.textSecondary + '40'} />
                <Text style={{ marginTop: 10, color: theme.textSecondary }}>No moments shared yet</Text>
              </View>
            )}
          </View>

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            {profile.languages?.length > 0 && (
              <View style={[styles.detailCard, { flex: 1.5 }]}>
                <Ionicons name="language" size={20} color={theme.teal} />
                <Text style={styles.detailCardLabel}>Languages</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {profile.languages.map((l: string, idx: number) => (
                    <Text key={l} style={styles.detailCardValue}>
                      {l}{idx < profile.languages.length - 1 ? ',' : ''}
                    </Text>
                  ))}
                </View>
              </View>
            )}
            {profile.gender && (
              <View style={styles.detailCard}>
                <Ionicons name="person" size={20} color={theme.teal} />
                <Text style={styles.detailCardLabel}>Gender</Text>
                <Text style={styles.detailCardValue}>{profile.gender}</Text>
              </View>
            )}
          </View>

          {!isAuthenticated && (
            <View style={styles.guestCta}>
              <Ionicons name="lock-closed" size={32} color={theme.teal} style={{ marginBottom: 12 }} />
              <Text style={styles.guestTitle}>Connect with {profile.firstName}</Text>
              <Text style={styles.guestSubtitle}>Sign in to message, match, and plan trips with travelers like {profile.firstName}.</Text>
              <TouchableOpacity
                style={styles.guestBtn}
                onPress={() => navigation.navigate('Auth')}
              >
                <Text style={styles.guestBtnText}>Login to Connect</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {renderFooter()}

      <Modal
        visible={showTrips}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTrips(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTrips(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip History</Text>
              <TouchableOpacity onPress={() => setShowTrips(false)}>
                <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {profile.completedTrips && profile.completedTrips.length > 0 ? (
                profile.completedTrips.map((trip: any, idx: number) => (
                  <View key={idx} style={styles.tripTimelineItem}>
                    <View style={styles.tripTimelineNode}>
                      <View style={styles.tripDot} />
                      {idx < profile.completedTrips.length - 1 && <View style={styles.tripLine} />}
                    </View>
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripCities}>{trip.origin?.city} ✈️ {trip.destination?.city}</Text>
                      <View style={styles.tripMeta}>
                        <Ionicons name="calendar-outline" size={14} color={theme.teal} />
                        <Text style={styles.tripMetaText}>
                          {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                        </Text>
                        <View style={styles.metaDot} />
                        <Ionicons name="time-outline" size={14} color={theme.teal} />
                        <Text style={styles.tripMetaText}>{trip.duration} days</Text>
                      </View>
                      {trip.details && (
                        <Text style={styles.tripDetailsText}>{trip.details}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Ionicons name="airplane-outline" size={50} color={theme.tealLight} />
                  <Text style={{ marginTop: 15, color: theme.textSecondary, fontWeight: '600' }}>No trips completed yet</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Modals */}
      <PostCommentsModal
        ref={commentsModalRef}
        postId={selectedPostId || ''}
      />
      <PostLikesModal
        ref={likesModalRef}
        postId={selectedPostId || ''}
      />
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
  hero: { height: 500, position: 'relative' },
  heroPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },
  backBtn: {
    position: 'absolute', left: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  shareBtn: {
    position: 'absolute', right: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  dots: {
    position: 'absolute', left: 60, right: 60,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: theme.textWhite },
  heroInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 25, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: { fontSize: 32, fontWeight: '800', color: theme.textWhite, letterSpacing: -0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: '900', color: theme.textWhite },
  lastSeenText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  locationTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  locationText: { fontSize: 13, color: theme.textWhite, fontWeight: '600' },

  content: { marginTop: -25, backgroundColor: theme.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, backgroundColor: theme.card, borderRadius: 20, marginBottom: 25 },
  statItem: { alignItems: 'center', flex: 1 },
  statDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.border },
  statNumber: { fontSize: 20, fontWeight: '800', color: theme.text },
  statLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginTop: 2 },

  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 15 },
  bioText: { fontSize: 16, color: theme.textSecondary, lineHeight: 24 },

  travelCard: { borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' },
  travelTimeline: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineNode: { alignItems: 'center', width: 24, marginRight: 15 },
  timelineLine: { width: 2, height: 25, backgroundColor: theme.teal + '20', borderRadius: 1 },
  timelineContent: { flex: 1 },
  travelLabel: { fontSize: 11, fontWeight: '800', color: theme.teal, textTransform: 'uppercase', letterSpacing: 1 },
  travelValue: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 2 },
  travelDateBox: { backgroundColor: theme.card, padding: 12, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  dateMonth: { fontSize: 12, fontWeight: '800', color: theme.orange, textTransform: 'uppercase' },
  dateDay: { fontSize: 22, fontWeight: '800', color: theme.text },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 15,
    backgroundColor: theme.tealLight, borderWidth: 1, borderColor: theme.border,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 14, color: theme.teal, fontWeight: '700' },

  detailsGrid: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  detailCard: { flex: 1, backgroundColor: theme.card, padding: 15, borderRadius: 18, gap: 5 },
  detailCardLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase' },
  detailCardValue: { fontSize: 15, fontWeight: '700', color: theme.text },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, justifyContent: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  footerGradient: { ...StyleSheet.absoluteFillObject },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, alignItems: 'center' },
  secondaryActionBtn: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.md
  },
  followBtn: { flex: 1, height: 56, borderRadius: 18, backgroundColor: theme.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...SHADOW.md },
  followingBtn: { backgroundColor: theme.white, borderWidth: 2, borderColor: theme.teal },
  followBtnText: { color: theme.textWhite, fontSize: 16, fontWeight: '800' },
  followingBtnText: { color: theme.teal },
  messageBtn: { flex: 1, height: 56, borderRadius: 18, overflow: 'hidden', ...SHADOW.md },
  messageBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  messageBtnText: { color: theme.textWhite, fontSize: 16, fontWeight: '800' },

  // Modal & Trip Timeline Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.card, height: '70%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 25, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
  tripTimelineItem: { flexDirection: 'row', marginBottom: 25 },
  tripTimelineNode: { alignItems: 'center', width: 20, marginRight: 15 },
  tripDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.teal, borderWidth: 2, borderColor: theme.tealLight },
  tripLine: { width: 2, flex: 1, backgroundColor: theme.tealLight, marginVertical: 4 },
  tripInfo: { flex: 1, backgroundColor: theme.background, padding: 15, borderRadius: 18 },
  tripCities: { fontSize: 16, fontWeight: '700', color: theme.text },
  tripMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  tripMetaText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600', marginLeft: 4 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textSecondary, marginHorizontal: 8 },
  tripDetailsText: { fontSize: 14, color: theme.textSecondary, marginTop: 10, lineHeight: 20, fontStyle: 'italic' },
  guestCta: {
    marginTop: 20,
    padding: 30,
    borderRadius: 24,
    backgroundColor: theme.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.teal + '30',
    ...SHADOW.md,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  guestBtn: {
    backgroundColor: theme.teal,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 18,
    ...SHADOW.lg,
  },
  guestBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  }
});
