import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Image, Alert, Dimensions, Modal, TextInput, ActivityIndicator,
  Platform, PanResponder, RefreshControl, StatusBar, Share
} from 'react-native';
import { 
  BottomSheetModal, 
  BottomSheetView, 
  BottomSheetBackdrop 
} from '@gorhom/bottom-sheet';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppDispatch, RootState } from '../store';
import { logout, setUser } from '../store/slices/authSlice';
import { 
  fetchUserPosts, 
  clearUserPosts,
  Post 
} from '../store/slices/feedSlice';
import { userAPI } from '../api/services';
import TravelPostCard from '../components/TravelPostCard';
import PostCommentsModal from '../components/PostCommentsModal';
import PostLikesModal from '../components/PostLikesModal';
import EditPostModal from '../components/EditPostModal';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { toggleTheme } from '../store/slices/themeSlice';
import { GOOGLE_MAPS_API_KEY } from '../api/client';

const { width: W } = Dimensions.get('window');

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const { user } = useSelector((s: RootState) => s.auth);
  const { userPosts } = useSelector((s: RootState) => s.feed);
  const mode = theme.mode;

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [activeField, setActiveField] = useState<'origin' | 'destination'>('origin');
  const [refreshing, setRefreshing] = useState(false);

  // Post Interaction States
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const menuSheetRef = useRef<BottomSheetModal>(null);
  const commentsModalRef = useRef<any>(null);
  const likesModalRef = useRef<any>(null);
  const editPostModalRef = useRef<any>(null);

  const renderBackdrop = React.useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    []
  );

  const handleOpenMenu = () => menuSheetRef.current?.present();

  const handleShareProfile = async () => {
    const shareUrl = `https://ekalgo.com/user/${user?._id}`;
    try {
      await Share.share({
        title: 'Join me on EkalGo!',
        message: `Check out my travel profile on EkalGo! 🌍✨\n\nView Profile: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (user?._id) {
      dispatch(fetchUserPosts({ userId: user._id, page: 1 }));
    }
    return () => {
      dispatch(clearUserPosts());
    };
  }, [user?._id]);

  const refreshProfile = async () => {
    setRefreshing(true);
    try {
      const res = await userAPI.getProfile();
      if (res.data.user) {
        dispatch(setUser(res.data.user));
        if (res.data.user._id) {
          await dispatch(fetchUserPosts({ userId: res.data.user._id, page: 1 })).unwrap();
        }
      }
    } catch (error) {
      console.warn('[ProfileScreen] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      refreshProfile();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          dispatch(logout());
        },
      },
    ]);
  };

  const profilePhoto = user?.photos?.find(p => p.isProfile)?.url || user?.photos?.[0]?.url;
  const photos = user?.photos || [];
  const interests = user?.interests || [];
  const languages = user?.languages || [];
  const lookingFor = user?.lookingFor || [];

  const INTEREST_EMOJIS: Record<string, string> = {
    Mountains: '🏔️', Beaches: '🏖️', 'Road Trips': '🚗', Trekking: '🥾',
    Camping: '⛺', Photography: '📸', 'Food Travel': '🍜', 'Cultural Travel': '🏛️',
    'Adventure Sports': '🪂', Backpacking: '🎒', 'Solo Travel': '🧍', Cruises: '🚢',
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      enableOnAndroid={true}
      extraScrollHeight={20}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshProfile} colors={[theme.teal]} tintColor={theme.teal} />
      }
    >
      <View style={styles.heroContainer}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

        <TouchableOpacity
          activeOpacity={1}
          style={styles.heroPhotoWrapper}
          onPress={() => setShowFullPhoto(true)}
        >
          <Image
            source={{ uri: photos[activePhotoIndex]?.url || profilePhoto }}
            style={styles.heroPhoto}
          />
        </TouchableOpacity>

        <LinearGradient
          colors={[
            'rgba(0,0,0,0.2)',
            'rgba(0,0,0,0.4)',
            'rgba(0,0,0,0.85)'
          ]}
          style={styles.heroOverlay}
        />

        <View style={styles.heroInfo} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.heroName}>
              {user?.firstName} {user?.lastName}
            </Text>
            {user?.isPhotoVerified && (
              <Ionicons name="checkmark-circle" size={22} color={theme.teal} style={{ marginLeft: 8 }} />
            )}
          </View>

          <Text style={styles.heroMeta}>
            {user?.age} • {user?.gender}
          </Text>

          <Text style={styles.heroLocation}>
            📍 {user?.location?.city || user?.city || 'Exploring'}
            {(user?.location?.city || user?.city) && (user?.location?.country || user?.country) ? `, ${user?.location?.country || user?.country}` : ''}
          </Text>
        </View>

        <TouchableOpacity 
          activeOpacity={1}
          style={StyleSheet.absoluteFillObject}
          onPress={(e) => {
            const x = e.nativeEvent.locationX;
            if (x < W * 0.3) {
              setActivePhotoIndex(i => Math.max(0, i - 1));
            } else if (x > W * 0.7) {
              if (photos.length > 1) {
                setActivePhotoIndex(i => (i + 1) % photos.length);
              }
            } else {
              setShowFullPhoto(true);
            }
          }}
        />

        <View style={[styles.topBar, { paddingTop: safeTop }]}>
          <TouchableOpacity onPress={handleOpenMenu}>
            <View style={styles.iconBtn}>
              <Ionicons name="menu-outline" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('WhoLikedMe')}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{user?.likesReceived || 0}</Text>
          <View style={styles.statLabelRow}>
            <Text style={[styles.statLabel, styles.statLabelTeal]}>Likes</Text>
            <Ionicons name="chevron-forward" size={11} color={theme.teal} />
          </View>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('MyMatches')}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{user?.matchesCount || 0}</Text>
          <View style={styles.statLabelRow}>
            <Text style={[styles.statLabel, styles.statLabelTeal]}>Matches</Text>
            <Ionicons name="chevron-forward" size={11} color={theme.teal} />
          </View>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('TripHistory')}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{user?.completedTrips?.length || 0}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('ProfileViews')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statNumber, { color: theme.orange }]}>{user?.viewsCount || 0}</Text>
          <View style={styles.statLabelRow}>
            <Text style={[styles.statLabel, { color: theme.orange, fontWeight: '700' }]}>Views</Text>
            <Ionicons name="eye-outline" size={11} color={theme.orange} />
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Content */}

      {/* ── Travel Posts Section ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Travel Moments</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.badgeText}>{userPosts.length}</Text>
          </View>
        </View>

        {userPosts.length > 0 ? (
          <View style={{ gap: 20 }}>
            {userPosts.map((post) => (
              <TravelPostCard
                key={post._id}
                post={post}
                onPressComment={(id) => {
                  setSelectedPostId(id);
                  commentsModalRef.current?.present();
                }}
                onPressLikes={(id) => {
                  setSelectedPostId(id);
                  likesModalRef.current?.present();
                }}
                onPressEdit={(p) => {
                  setEditingPost(p);
                  editPostModalRef.current?.present();
                }}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyPostsContainer}>
            <Ionicons name="images-outline" size={48} color={theme.teal + '40'} />
            <Text style={styles.emptyPostsText}>You haven't shared any travel moments yet.</Text>
            <TouchableOpacity 
              style={styles.createPostLink}
              onPress={() => navigation.navigate('Travelers', { initialTab: 'feed' })}
            >
              <Text style={styles.createPostLinkText}>Share your first moment!</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />

      <View style={{ height: 40 }} />

      {/* Profile Menu Bottom Sheet */}
      <BottomSheetModal
        ref={menuSheetRef}
        index={0}
        snapPoints={['50%']}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: theme.border }}
        backgroundStyle={{ backgroundColor: theme.card }}
      >
        <BottomSheetView style={styles.menuContent}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Profile Options</Text>
          </View>

          <View style={styles.menuList}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                menuSheetRef.current?.dismiss();
                navigation.navigate('EditProfile');
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.tealLight }]}>
                <Ionicons name="person-outline" size={20} color={theme.teal} />
              </View>
              <Text style={styles.menuLabel}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => dispatch(toggleTheme())}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.goldLight }]}>
                <Ionicons 
                  name={mode === 'light' ? 'moon-outline' : 'sunny-outline'} 
                  size={20} 
                  color={theme.gold} 
                />
              </View>
              <Text style={styles.menuLabel}>{mode === 'light' ? 'Dark Mode' : 'Light Mode'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                menuSheetRef.current?.dismiss();
                navigation.navigate('TripHistory');
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.tealLight }]}>
                <Ionicons name="trail-sign-outline" size={20} color={theme.teal} />
              </View>
              <Text style={styles.menuLabel}>My Trip History</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                menuSheetRef.current?.dismiss();
                navigation.navigate('Settings');
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="settings-outline" size={20} color={theme.info} />
              </View>
              <Text style={styles.menuLabel}>App Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                menuSheetRef.current?.dismiss();
                handleShareProfile();
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.orangeLight }]}>
                <Ionicons name="share-social-outline" size={20} color={theme.orange} />
              </View>
              <Text style={styles.menuLabel}>Share Profile</Text>
            </TouchableOpacity>

            {!user?.isPhotoVerified && (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => {
                  menuSheetRef.current?.dismiss();
                  navigation.navigate('Verification');
                }}
              >
                <View style={[styles.menuIcon, { backgroundColor: theme.success + '20' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={theme.success} />
                </View>
                <Text style={styles.menuLabel}>Get Verified</Text>
              </TouchableOpacity>
            )}

            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={[styles.menuItem, { marginTop: 10 }]} 
              onPress={() => {
                menuSheetRef.current?.dismiss();
                handleLogout();
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.error + '10' }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.error} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.error }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* ── Interaction Modals ── */}
      <PostCommentsModal 
        ref={commentsModalRef} 
        postId={selectedPostId || ''} 
      />
      
      <PostLikesModal 
        ref={likesModalRef} 
        postId={selectedPostId || ''} 
      />

      <EditPostModal
        ref={editPostModalRef}
        post={editingPost}
        onClose={() => setEditingPost(null)}
      />
    </KeyboardAwareScrollView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  heroContainer: { height: 460, width: '100%', position: 'relative', backgroundColor: '#000' },
  heroPhotoWrapper: { width: '100%', height: '100%' },
  heroLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -40, // 🔥 floating effect
    borderRadius: 20,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    zIndex: 10,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: FONTS.xl, fontWeight: '800', color: theme.teal },
  statLabel: { fontSize: FONTS.xs, color: theme.textSecondary, marginTop: 2 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 2 },
  statLabelTeal: { color: theme.teal, fontWeight: '700' },
  statDivider: { width: 1, backgroundColor: theme.border },

  verifyBanner: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.teal + '30',
  },
  verifyBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  verifyIconBG: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  verifyTitle: {
    fontSize: FONTS.base,
    fontWeight: '700',
    color: theme.teal,
  },
  verifySubtitle: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },

  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '800', color: theme.text, marginBottom: 12 },
  bioText: { fontSize: FONTS.base, color: theme.textSecondary, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: theme.tealLight, borderWidth: 1, borderColor: theme.teal + '40',
  },
  interestEmoji: { fontSize: 15 },
  interestLabel: { fontSize: FONTS.sm, color: theme.teal, fontWeight: '600' },
  langChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: theme.goldLight,
  },
  langLabel: { fontSize: FONTS.sm, color: theme.text, fontWeight: '500' },
  lookingChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: theme.orangeLight,
  },
  lookingLabel: { fontSize: FONTS.sm, color: theme.orange, fontWeight: '600' },
  travelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  travelText: { flex: 1, fontSize: FONTS.base, color: theme.textSecondary },
  travelValue: { color: theme.text, fontWeight: '600' },
  actionBtns: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 20, marginTop: 28,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderColor: theme.teal, borderRadius: RADIUS.full, paddingVertical: 14,
  },
  editBtnText: { color: theme.teal, fontWeight: '700', fontSize: FONTS.base },
  settingsBtn: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16,
    paddingVertical: 14, borderRadius: RADIUS.full,
    backgroundColor: theme.error + '10',
  },
  logoutText: { color: theme.error, fontWeight: '700', fontSize: FONTS.base },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  emptyTravelText: { fontSize: 13, color: theme.textSecondary, fontStyle: 'italic' },

  historySection: { backgroundColor: theme.background, marginTop: 15, padding: 25 },
  historyTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
  addTripMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.teal,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    gap: 4
  },
  addTripMiniBtnText: { fontSize: 14, fontWeight: '800', color: theme.textWhite },
  tripItem: { marginBottom: 15, borderRadius: 20, backgroundColor: theme.card, ...SHADOW.sm, overflow: 'hidden' },
  tripItemContent: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  tripIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.tealLight, alignItems: 'center', justifyContent: 'center' },
  tripCities: { fontSize: 16, fontWeight: '700', color: theme.text },
  tripDates: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  tripDetailsText: { fontSize: 13, color: theme.textSecondary, marginTop: 4, fontStyle: 'italic' },
  tripActions: { flexDirection: 'row', gap: 10 },
  tripActionBtn: { padding: 8 },
  emptyTripsContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTripsText: { fontSize: 14, color: theme.textSecondary, marginTop: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.text },
  modalSubtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8, marginTop: 12 },
  tripInput: { backgroundColor: theme.background, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: theme.border, padding: 14, fontSize: 16, color: theme.text },
  modalSuggestionsContainer: { backgroundColor: theme.card, borderRadius: RADIUS.md, ...SHADOW.md, marginTop: 4, borderWidth: 1, borderColor: theme.border },
  suggestionItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  suggestionText: { color: theme.text, fontSize: 14 },
  submitTripBtn: { backgroundColor: theme.teal, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginTop: 24, ...SHADOW.md },
  submitTripBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  heroPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  iconBtn: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 20,
  },
  heroInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  heroMeta: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },

  // Posts Section Styles
  sectionBadge: {
    backgroundColor: theme.teal + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.teal,
  },
  emptyPostsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  emptyPostsText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 15,
    paddingHorizontal: 40,
  },
  createPostLink: {
    marginTop: 15,
  },
  createPostLinkText: {
    color: theme.teal,
    fontWeight: '700',
    fontSize: 14,
  },
  // Full Screen Viewer
  fullScreenOverlay: { flex: 1, backgroundColor: '#000' },
  fullImage: { width: W, height: '100%' },
  viewerHeader: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
    zIndex: 100
  },
  viewerIndex: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  closeFullBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center'
  },
  menuContent: {
    padding: 24,
    paddingTop: 8,
  },
  menuHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  menuList: {
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 10,
  },
});
