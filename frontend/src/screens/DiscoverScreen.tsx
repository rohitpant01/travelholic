import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pressable, 
  View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated,
  Dimensions, ActivityIndicator, Alert, Modal, Platform, TextInput,
  KeyboardAvoidingView, ScrollView, Keyboard
 } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchNotifications } from '../store/slices/notificationSlice';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { discoverAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { requestLocationPermission } from '../utils/permissionUtils';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
const ShimmerPlaceholder = createShimmerPlaceholder(LinearGradient);


import Swiper from 'react-native-deck-swiper';
import { GOOGLE_MAPS_API_KEY } from '../api/client';

// New Components
import DiscoveryHeader from '../components/DiscoveryHeader';
import TravelerDiscoveryCard, { Profile } from '../components/TravelerDiscoveryCard';
import FeedTab from '../components/FeedTab';
import ScreenWrapper from '../components/ScreenWrapper';
import NearbyTravelersView from '../components/NearbyTravelersView';
import { useLocationTracker } from '../hooks/useLocationTracker';
import Slider from '@react-native-community/slider';

const { width: W, height: H } = Dimensions.get('window');

export default function DiscoverScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch<AppDispatch>();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const swiperRef = useRef<any>(null);

  const { user } = useSelector((state: RootState) => state.auth);
  const { unreadCount } = useSelector((state: RootState) => state.notification);

  // Discovery State
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState<'discover' | 'feed'>('feed');
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');
  const [matchPopup, setMatchPopup] = useState<{ name: string; photo?: string } | null>(null);
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Filter Settings
  const [maxDistance, setMaxDistance] = useState(user?.maxDiscoveryDistance || 200);
  const [ghostMode, setGhostMode] = useState(user?.visibilityStatus === 'ghost');
  const [travelModeCity, setTravelModeCity] = useState('');
  const [manualCoords, setManualCoords] = useState<{ lat: number, lng: number } | null>(null);
  
  // Suggestion State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { location, refreshLocation } = useLocationTracker();

  const toggleGhostMode = async () => {
    try {
      const newStatus = !ghostMode ? 'ghost' : 'public';
      setGhostMode(!ghostMode);
      await discoverAPI.updateVisibility(newStatus);
    } catch (e) {}
  };

  const fetchCitySuggestions = async (text: string) => {
    setTravelModeCity(text);
    if (text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=(cities)&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK') {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const selectCitySuggestion = async (item: any) => {
    Keyboard.dismiss();
    const fallbackText = item.structured_formatting?.main_text || item.description?.split(',')[0] || '';
    setTravelModeCity(fallbackText);
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK') {
        const lat = data.result.geometry.location.lat;
        const lng = data.result.geometry.location.lng;
        setManualCoords({ lat, lng });
        Alert.alert('Travel Mode Active', `Finding travelers interested in ${fallbackText}`);
      } else {
        throw new Error('No geometry');
      }
    } catch (e) {
      console.warn('Place details failed, falling back to name search');
      setManualCoords({ lat: 1, lng: 1 });
      fetchProfiles(true);
    }
  };

  useEffect(() => {
    if (route.params?.initialTab === 'feed') {
      setActiveTab('feed');
    }
  }, [route.params?.initialTab]);

  useEffect(() => {
    if (user && !user.isEmailVerified && (user.registrationStep || 0) >= 9) {
      setShowVerifyPopup(true);
    }
  }, [user?.isEmailVerified, user?.registrationStep]);

  const fetchProfiles = useCallback(async (reset = false) => {
    if (loading && !reset) return;
    if (!reset && !hasMore) return;

    if (reset) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const targetPage = reset ? 1 : page;
      let lat: number | undefined;
      let lng: number | undefined;

      if (manualCoords) {
        lat = manualCoords.lat;
        lng = manualCoords.lng;
      } else {
        let { status } = await requestLocationPermission(
          'Nearby Travelers',
          'Search for travelers and moments near you. EkalGo uses your location to show you local adventures.'
        );
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
        }
      }

      console.log(`[DISCOVER] Fetching profiles - Page: ${targetPage}, Mode: ${travelModeCity ? 'Travel' : 'Near'}, City: ${travelModeCity || 'GPS'}`);

      const res = await discoverAPI.getProfiles(
        lat, 
        lng, 
        'default', 
        viewMode === 'list' ? 'distance' : undefined,
        targetPage,
        20,
        travelModeCity
      );

      const newProfiles = res.data.profiles || [];
      
      setProfiles(prev => {
        const combined = reset ? newProfiles : [...prev, ...newProfiles];
        const unique = Array.from(new Map(combined.map(p => [p._id, p])).values());
        return unique;
      });

      setPage(targetPage + 1);
      setHasMore(res.data.hasMore);
    } catch (e) {
      console.error('[FETCH PROFILES ERROR]', e);
      if (reset) Alert.alert('Error', 'Could not load profiles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, hasMore, page, manualCoords, viewMode, travelModeCity]);


  useEffect(() => {
    fetchProfiles(true);
    dispatch(fetchNotifications());
  }, [viewMode, manualCoords, travelModeCity]); 


  const handleLike = async (index: number | string) => {
    const profile = typeof index === 'number' ? profiles[index] : profiles.find(p => p._id === index);
    if (!profile) return;
    
    // Optimistic remove for List View
    if (viewMode === 'list') {
      setProfiles(prev => prev.filter(p => p._id !== profile._id));
    }

    try {
      const res = await discoverAPI.like(profile._id);
      if (res.data.matched) {
        setMatchPopup({ name: res.data.matchedUser.firstName, photo: res.data.matchedUser.profilePhoto });
        setTimeout(() => setMatchPopup(null), 3500);
      }
    } catch (e) { }
  };

  const handleSkip = async (index: number | string) => {
    const profile = typeof index === 'number' ? profiles[index] : profiles.find(p => p._id === index);
    if (!profile) return;

    if (viewMode === 'list') {
      setProfiles(prev => prev.filter(p => p._id !== profile._id));
    }

    try { await discoverAPI.skip(profile._id); } catch (e) { }
  };

  const handleSuperLike = async (index: number | string) => {
    const profile = typeof index === 'number' ? profiles[index] : profiles.find(p => p._id === index);
    if (!profile) return;

    if (viewMode === 'list') {
      setProfiles(prev => prev.filter(p => p._id !== profile._id));
    }

    try {
      const res = await discoverAPI.superLike(profile._id);
      if (res.data.matched) {
        setMatchPopup({ name: res.data.matchedUser.firstName, photo: res.data.matchedUser.profilePhoto });
        setTimeout(() => setMatchPopup(null), 3500);
      }
    } catch (e) { }
  };

  const handleSwipedAll = () => {
    setProfiles([]); // Triggers the empty state UI
  };

  const renderDiscoveryCard = useCallback((profile: any) => (
    <View style={styles.cardWrapper}>
      <TravelerDiscoveryCard
        profile={profile}
        onPressProfile={(p) => navigation.navigate('UserDetail', {
          userId: p._id,
          profile: p,
          onActionPerformed: () => {
            setProfiles(prev => prev.filter(item => item._id !== p._id));
          }
        })}
      />
    </View>
  ), [navigation, theme, styles.cardWrapper]);


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
    <ScreenWrapper withTopInset={false} withBottomInset={false}>
      <DiscoveryHeader
        unreadCount={unreadCount}
        onSavedPress={() => navigation.navigate('SavedDestinations')}
        onNotificationsPress={() => navigation.navigate('Notifications')}
        onFilterPress={() => setShowFilterModal(true)}
        viewMode={viewMode}
        onToggleView={() => setViewMode(v => v === 'swipe' ? 'list' : 'swipe')}
      />

      <View style={styles.tabSwitcherContainer}>
        <View style={styles.tabSwitcher}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setActiveTab('feed')}
            style={[styles.tabItem, activeTab === 'feed' && styles.activeTabItem]}
          >
            <Ionicons name={activeTab === 'feed' ? 'sparkles' : 'sparkles-outline'} size={18} color={activeTab === 'feed' ? theme.textWhite : theme.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>Travel Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setActiveTab('discover')}
            style={[styles.tabItem, activeTab === 'discover' && styles.activeTabItem]}
          >
            <Ionicons name={activeTab === 'discover' ? 'people' : 'people-outline'} size={18} color={activeTab === 'discover' ? theme.textWhite : theme.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>Find Travelers</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentArea}>
        {activeTab === 'feed' ? (
          <FeedTab />
        ) : loading ? (
          renderShimmer()
        ) : profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyTitle}>Discover Travelers</Text>
            <Text style={styles.emptySubtitle}>No travelers nearby right now, but your journey is waiting.</Text>
            <View style={{ gap: 12 }}>
              <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('AllDestinations')}>
                <Text style={styles.exploreBtnText}>Explore Destinations</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.refreshBtn} onPress={fetchProfiles}>
                <Ionicons name="refresh" size={18} color={theme.teal} />
                <Text style={[styles.refreshBtnText, { color: theme.teal }]}>Refresh Feed</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {viewMode === 'swipe' ? (
              <Swiper
                key={`swiper-${profiles.length}-${viewMode}`}
                ref={swiperRef}
                cards={profiles}
                renderCard={renderDiscoveryCard}
                onSwipedRight={(index) => handleLike(index)}
                onSwipedLeft={(index) => handleSkip(index)}
                onSwipedTop={(index) => handleSuperLike(index)}
                onSwipedAll={handleSwipedAll}
                cardIndex={0}
                backgroundColor={'transparent'}
                stackSize={3}
                stackSeparation={15}
                animateCardOpacity
                cardVerticalMargin={0}
                containerStyle={styles.swiperContainer}
                disableBottomSwipe
                animateOverlayLabelsOpacity
                useViewOverflow={Platform.OS === 'ios'}
                overlayOpacityVerticalThreshold={H * 0.1}
                overlayOpacityHorizontalThreshold={W * 0.1}
                verticalThreshold={H * 0.15}
                horizontalThreshold={W * 0.15}
                overlayLabels={{
                  left: {
                    title: 'NOPE',
                    style: {
                      label: {
                        backgroundColor: theme.error,
                        borderColor: theme.error,
                        color: 'white',
                        borderWidth: 1
                      },
                      wrapper: {
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-start',
                        marginTop: 30,
                        marginLeft: -30
                      }
                    }
                  },
                  right: {
                    title: 'LIKE',
                    style: {
                      label: {
                        backgroundColor: theme.teal,
                        borderColor: theme.teal,
                        color: 'white',
                        borderWidth: 1
                      },
                      wrapper: {
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        marginTop: 30,
                        marginLeft: 30
                      }
                    }
                  },
                  top: {
                    title: 'SUPER LIKE',
                    style: {
                      label: {
                        backgroundColor: theme.gold,
                        borderColor: theme.gold,
                        color: 'white',
                        borderWidth: 1
                      },
                      wrapper: {
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }
                    }
                  }
                }}
              />
            ) : (
              <NearbyTravelersView 
                profiles={profiles}
                loading={loading}
                refreshing={refreshing}
                onRefresh={() => fetchProfiles(true)}
                onLoadMore={() => fetchProfiles(false)}
                hasMore={hasMore}
                ghostMode={ghostMode}
                onProfilePress={(p: any) => navigation.navigate('UserDetail', { 
                  userId: p._id, 
                  profile: p,
                  onActionPerformed: () => {
                    setProfiles(prev => prev.filter(item => item._id !== p._id));
                  }
                })}
                onLike={(p: any) => handleLike(p._id)}
                onSuperLike={(p: any) => handleSuperLike(p._id)}
              />
            )}

            {/* Floating Actions - Only for Swipe Mode */}
            {viewMode === 'swipe' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.skipBtn]}
                  onPress={() => swiperRef.current?.swipeLeft()}
                >
                  <Ionicons name="close" size={32} color={theme.error} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.superLikeBtn]}
                  onPress={() => swiperRef.current?.swipeTop()}
                >
                  <Ionicons name="star" size={28} color={theme.gold} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.likeBtn]}
                  onPress={() => swiperRef.current?.swipeRight()}
                >
                  <Ionicons name="heart" size={32} color={theme.teal} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

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

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilterModal(false)} />
          <View style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Discovery Settings</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <View style={styles.filterOptionLabel}>
                <Text style={styles.filterLabel}>Maximum Distance</Text>
                <Text style={styles.filterValue}>{maxDistance} km</Text>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={10}
                maximumValue={500}
                step={5}
                value={maxDistance}
                onValueChange={setMaxDistance}
                minimumTrackTintColor={theme.teal}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.teal}
              />
            </View>

            <View style={[styles.filterSection, { zIndex: 9999 }]}>
              <Text style={styles.filterLabel}>Travel Mode (Explore Other Cities)</Text>
              <View style={[styles.citySearchContainer, showSuggestions && suggestions.length > 0 && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                <Ionicons name="search" size={18} color={theme.textSecondary} />
                <TextInput
                  placeholder="Enter city name..."
                  placeholderTextColor={theme.textLight}
                  style={styles.cityInput}
                  value={travelModeCity}
                  onChangeText={fetchCitySuggestions}
                  onFocus={() => { if (travelModeCity.length >= 3) setShowSuggestions(true); }}
                  onSubmitEditing={async () => {
                    if (!travelModeCity) {
                      setManualCoords(null);
                      return;
                    }
                    try {
                      // 📍 Primary: Use custom geocoding for distance accuracy
                      const geo = await Location.geocodeAsync(travelModeCity);
                      if (geo.length > 0) {
                        setManualCoords({ lat: geo[0].latitude, lng: geo[0].longitude });
                        Alert.alert('Travel Buddy Mode', `Finding travelers interested in ${travelModeCity}`);
                      } else {
                        setManualCoords({ lat: 1, lng: 1 }); 
                        fetchProfiles(true);
                      }
                    } catch (e) {
                      console.warn('Geocoding failed, falling back to name search');
                      setManualCoords({ lat: 1, lng: 1 });
                      fetchProfiles(true);
                    }
                  }}
                />
              </View>
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 180 }} keyboardShouldPersistTaps="always">
                    {suggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => selectCitySuggestion(item)}
                      >
                        <Ionicons name="location-outline" size={18} color={theme.teal} style={{ marginRight: 8 }} />
                        <Text style={styles.suggestionText} numberOfLines={1}>
                          {item.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              {manualCoords && (
                <TouchableOpacity onPress={() => { setManualCoords(null); setTravelModeCity(''); fetchProfiles(); }} style={styles.resetTravelMode}>
                  <Text style={styles.resetTravelText}>Reset to My Location</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.filterToggle, ghostMode && styles.filterToggleActive]} 
              onPress={toggleGhostMode}
            >
              <View style={styles.toggleTextContainer}>
                <Ionicons name={ghostMode ? "eye-off" : "eye"} size={20} color={ghostMode ? "#fff" : theme.teal} />
                <View>
                  <Text style={[styles.toggleTitle, ghostMode && { color: '#fff' }]}>Ghost Mode</Text>
                  <Text style={[styles.toggleDesc, ghostMode && { color: 'rgba(255,255,255,0.8)' }]}>
                    {ghostMode ? "You are invisible to others" : "Everyone can see you nearby"}
                  </Text>
                </View>
              </View>
              <View style={[styles.switchTrack, ghostMode && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, ghostMode && styles.switchThumbActive]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.applyBtn} 
              onPress={() => {
                setShowFilterModal(false);
                fetchProfiles(true);
              }}
            >
              <Text style={styles.applyBtnText}>Apply Settings</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Verification Pop-up */}
      <Modal visible={showVerifyPopup} transparent={true} animationType="fade" onRequestClose={() => setShowVerifyPopup(false)}>
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
    </ScreenWrapper>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  contentArea: { flex: 1 },
  
  // Tab Switcher
  tabSwitcherContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.background,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderRadius: 20,
    padding: 4,
    height: 48,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
  },
  activeTabItem: {
    backgroundColor: theme.teal,
    ...SHADOW.md,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  activeTabText: {
    color: theme.textWhite,
  },

  listContainer: { flex: 1, position: 'relative' },
  swiperContainer: {
    flex: 1,
    marginTop: -20, // Adjust to overlap header slightly for premium feel
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -210, // Move cards even higher to match previous position
  },

  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 24, paddingHorizontal: 40, gap: 20,
    backgroundColor: 'transparent',
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 10,
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
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  refreshBtnText: { fontWeight: '700', fontSize: 14 },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  filterCard: { backgroundColor: theme.card, width: '100%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40, ...SHADOW.lg },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  filterTitle: { fontSize: 20, fontWeight: '800', color: theme.text },
  filterSection: { marginBottom: 24 },
  filterOptionLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  filterLabel: { fontSize: 16, fontWeight: '700', color: theme.text },
  filterValue: { fontSize: 16, fontWeight: '800', color: theme.teal },
  
  filterToggle: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    backgroundColor: theme.backgroundSecondary, padding: 16, borderRadius: 20, marginBottom: 24,
    borderWidth: 1, borderColor: theme.border
  },
  filterToggleActive: { backgroundColor: '#6366f1', borderColor: '#4f46e5' },
  toggleTextContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  toggleDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  switchTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: theme.border, padding: 2 },
  switchTrackActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchThumbActive: { transform: [{ translateX: 20 }] },

  applyBtn: { backgroundColor: theme.teal, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  applyBtnText: { color: theme.textWhite, fontSize: 16, fontWeight: '800' },

  verifyPopupCard: { backgroundColor: theme.card, borderRadius: 24, padding: 24, width: W - 40, alignItems: 'center', ...SHADOW.lg },
  verifyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.teal + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  verifyTitle: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 8 },
  verifyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  verifyBtn: { backgroundColor: theme.teal, width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  verifyBtnText: { color: theme.textWhite, fontSize: 16, fontWeight: '700' },
  laterBtn: { paddingVertical: 8 },
  laterBtnText: { color: theme.textSecondary, fontSize: 14, fontWeight: '600' },

  citySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cityInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: theme.text,
    fontWeight: '600',
  },
  resetTravelMode: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  resetTravelText: {
    fontSize: 13,
    color: theme.teal,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  suggestionsContainer: {
    backgroundColor: theme.white,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...SHADOW.md,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
});
