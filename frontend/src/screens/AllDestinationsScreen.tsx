import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, Dimensions, 
  StatusBar, Linking, Platform, ScrollView, Pressable, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState } from '../store';
import { COLORS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { aiAPI, userAPI } from '../api/services';
import { setSavedDestinations, addSaved, removeSaved } from '../store/slices/savedSlice';
import { updateUser } from '../store/slices/authSlice';
import { fetchPlaceImage, getRichDestinations } from '../api/imageService';
import Animated, { 
  FadeInDown, 
  Layout, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  interpolate,
  withTiming,
  Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useToast } from '../context/ToastContext';
import { useSavedSync } from '../hooks/useSavedSync';
import ImageZoomViewer from '../components/ImageZoomViewer';
import ScreenWrapper from '../components/ScreenWrapper';

const { width } = Dimensions.get('window');

// Skeleton Loader Component
const SkeletonCard = ({ theme, styles }: { theme: any, styles: any }) => (
  <View style={[styles.card, { backgroundColor: theme.card, opacity: 0.7 }]}>
    <View style={[styles.skeletonImage, { backgroundColor: theme.border }]} />
  </View>
);

const FlipDestinationCard = ({ item, theme, onSave, index, isSaved, styles }: any) => {
  const rotate = useSharedValue(0);
  const heartScale = useSharedValue(1);
  const isFlipped = useSharedValue(false);
  const [zoomVisible, setZoomVisible] = useState(false);

  const flipCard = () => {
    isFlipped.value = !isFlipped.value;
    rotate.value = withSpring(isFlipped.value ? 180 : 0, {
      damping: 15,
      stiffness: 90
    });
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotate.value, [0, 180], [0, 180]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateValue}deg` }
      ] as any,
      opacity: interpolate(rotate.value, [0, 89, 90, 180], [1, 1, 0, 0]),
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotate.value, [0, 180], [180, 360]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateValue}deg` }
      ] as any,
      opacity: interpolate(rotate.value, [0, 89, 90, 180], [0, 0, 1, 1]),
    };
  });

  const animatedHeartStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: heartScale.value }]
    };
  });

  // Derived values for zIndex to avoid TS array errors
  const frontZIndex = useAnimatedStyle(() => ({
    zIndex: rotate.value > 90 ? 0 : 1
  }));
  const backZIndex = useAnimatedStyle(() => ({
    zIndex: rotate.value > 90 ? 1 : 0
  }));

  const handleToggleSave = () => {
    heartScale.value = withTiming(1.5, { duration: 150 }, () => {
      heartScale.value = withSpring(1);
    });
    onSave(item);
  };

  const openMap = () => {
    if (item.lat && item.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
      Linking.openURL(url).catch(err => console.error('An error occurred opening maps', err));
    }
  };

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 100)} 
      layout={Layout.springify()}
      style={styles.cardContainer}
    >
      <View style={styles.cardWrapper}>
        {/* FRONT SIDE */}
        <Animated.View style={[styles.flipCard, styles.card, frontAnimatedStyle, frontZIndex]}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={flipCard}
            onLongPress={() => setZoomVisible(true)}
          >
            <Image source={{ uri: item.image }} style={styles.image} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.frontGradient}>
              <View style={styles.frontTextContainer}>
                <Text style={styles.frontName}>
                  {item.name || item.title || 'Exploring...'}
                </Text>
                <View style={styles.locationRow}>
                    <Ionicons name="location" size={12} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.frontLocation}>
                      {item.location || 'Incredible India'}
                    </Text>
                </View>
              </View>
            </LinearGradient>
          </Pressable>

          <ImageZoomViewer
            images={item.image ? [item.image] : []}
            title={item.name || item.title}
            caption={item.description?.substring(0, 80) || ''}
            vibe={item.tags?.[0] || 'Hidden Gem'}
            visible={zoomVisible}
            onClose={() => setZoomVisible(false)}
          />
          
          <TouchableOpacity 
             style={styles.saveBtnFront} 
             onPress={handleToggleSave} 
             activeOpacity={0.7}
          >
            <Animated.View style={animatedHeartStyle}>
              <Ionicons name={isSaved ? "heart" : "heart-outline"} size={28} color={isSaved ? "#FF5A5F" : "#FFF"} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* BACK SIDE */}
        <Animated.View style={[styles.flipCard, styles.card, { backgroundColor: theme.card }, backAnimatedStyle, backZIndex]}>
           <TouchableOpacity style={styles.closeBtn} onPress={flipCard}>
             <Ionicons name="close-circle" size={32} color={theme.textLight} />
           </TouchableOpacity>

           <ScrollView 
             showsVerticalScrollIndicator={false}
             contentContainerStyle={styles.backScrollContent}
             nestedScrollEnabled={true}
          >
            <View style={styles.backHeader}>
              <Text style={[styles.backTitle, { color: theme.text }]}>{item.name || item.title}</Text>
              <View style={styles.locationRowBack}>
                <Ionicons name="location" size={14} color={COLORS.teal} />
                <Text style={[styles.backLocationLabel, { color: COLORS.teal }]}>
                  {item.location || 'Incredible India'}
                </Text>
              </View>
              <View style={styles.ratingRowBack}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={[styles.ratingTextBack, { color: theme.text }]}>
                  {item.rating || 4.8} <Text style={{ color: theme.textLight }}>(120+ reviews)</Text>
                </Text>
              </View>
            </View>

            <View style={styles.descContainer}>
                <Text style={styles.sectionLabel}>DETAILED STORY</Text>
                <Text style={[styles.backDescription, { color: theme.textSecondary }]}>{item.description}</Text>
            </View>

            <View style={styles.divider} />

            {item.whyLoveThis && item.whyLoveThis.length > 0 && (
                <View style={styles.whySection}>
                    <Text style={styles.sectionLabel}>✨ WHY YOU'LL LOVE THIS</Text>
                    {item.whyLoveThis.map((reason: string, i: number) => (
                        <View key={i} style={styles.reasonRow}>
                            <Ionicons name="sparkles" size={12} color={COLORS.teal} />
                            <Text style={[styles.reasonText, { color: theme.textSecondary }]}>{reason}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.insightRow}>
                <View style={[styles.insightBox, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={styles.sectionLabel}>📅 BEST TIME</Text>
                    <Text style={[styles.insightValue, { color: theme.text }]}>{item.bestTime || 'Nov – Feb'}</Text>
                </View>
                <View style={[styles.insightBox, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={styles.sectionLabel}>🏷️ TAGS</Text>
                    <View style={styles.tagWrap}>
                        {(item.tags || ['Hidden Gem']).map((tag: string, i: number) => (
                            <Text key={i} style={styles.tagTextSmall}>#{tag.replace(/\s+/g, '')} </Text>
                        ))}
                    </View>
                </View>
            </View>

            {(item.nearestCity || item.nearestAirport) && (
                <View style={styles.travelInfoSection}>
                    <Text style={styles.sectionLabel}>🚗 TRAVEL INFO</Text>
                    {item.nearestCity && (
                        <View style={styles.infoRow}>
                            <Ionicons name="navigate-outline" size={14} color={theme.textLight} />
                            <Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.nearestCity}</Text>
                        </View>
                    )}
                    {item.nearestAirport && (
                        <View style={styles.infoRow}>
                            <Ionicons name="airplane-outline" size={14} color={theme.textLight} />
                            <Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.nearestAirport}</Text>
                        </View>
                    )}
                </View>
            )}

            {item.travelTip && (
                <View style={styles.tipBox}>
                    <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                      💡 <Text style={{fontWeight: '700', color: theme.text}}>Travel Tip:</Text> {item.travelTip}
                    </Text>
                </View>
            )}
          </ScrollView>

          <View style={styles.backActions}>
              <TouchableOpacity style={styles.mapBtn} onPress={openMap} activeOpacity={0.8}>
                 <Ionicons name="map" size={18} color="#FFF" />
                 <Text style={styles.mapBtnText}>VIEW ON MAP</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                 style={[styles.saveToggleBtn, { borderColor: isSaved ? "#FF5A5F" : COLORS.teal }]} 
                 onPress={handleToggleSave}
              >
                  <Ionicons name={isSaved ? "heart" : "heart-outline"} size={18} color={isSaved ? "#FF5A5F" : COLORS.teal} />
                  <Text style={[styles.saveToggleText, { color: isSaved ? "#FF5A5F" : COLORS.teal }]}>
                      {isSaved ? "SAVED" : "SAVE"}
                  </Text>
              </TouchableOpacity>
          </View>
        </Animated.View>

      </View>
    </Animated.View>
  );
};

const TopDestinationItem = ({ place, theme, navigation, styles }: any) => {
  const [img, setImg] = useState(place.image);

  useEffect(() => {
    const enrich = async () => {
      // If image is missing, a placeholder, or from the old unsplash source redirect
      const isPlaceholder = !place.image || 
        place.image.includes('source.unsplash.com') || 
        place.image.includes('photo-1488646953014-85cb44e25828') ||
        place.image.includes('undefined');

      if (isPlaceholder) {
        const url = await fetchPlaceImage(place.name || place.title);
        if (url && !url.includes('undefined')) setImg(url);
      }
    };
    enrich();
  }, [place]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => navigation.navigate('PlaceDetails' as never, { 
        place: { 
          ...place, 
          name: place.name, 
          title: place.title || place.name, 
          image: img, 
          location: place.location, 
          description: place.description, 
          tags: [], 
          bestTime: place.duration, 
          lat: place.coordinates?.latitude, 
          lng: place.coordinates?.longitude 
        } 
      } as never)}
      style={[styles.topCard, { backgroundColor: theme.card }]}
    >
      <Image source={{ uri: img }} style={styles.topCardImage} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.topCardGradient}>
        <Text style={styles.topCardName} numberOfLines={1}>{place.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="location" size={10} color="rgba(255,255,255,0.7)" />
          <Text style={styles.topCardLocation} numberOfLines={1}>
            {place.location || 'India'}
          </Text>
        </View>
      </LinearGradient>
      <View style={styles.topCardRating}>
        <Ionicons name="star" size={10} color="#FFD700" />
        <Text style={styles.topCardRatingText}>{place.rating || 4.8}</Text>
      </View>
    </TouchableOpacity>
  );
};

const DEST_KEY = '@explore_destinations';
const DEST_TS_KEY = '@explore_destinations_ts';
const LOCAL_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in ms


const AllDestinationsScreen = () => {
  const theme = useAppTheme();
  const navigation: any = useNavigation();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  useSavedSync(); // Activate global sync
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { ids: savedIds } = useSelector((state: RootState) => state.saved);
  const styles = getStyles(theme, insets);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topDestinations, setTopDestinations] = useState<any[]>([]);
  const [topLoading, setTopLoading] = useState(true);


  useEffect(() => {
    loadDestinations();
    loadTopDestinations();
  }, []);

  const loadTopDestinations = async () => {
    setTopLoading(true);
    try {
      const res = await aiAPI.getTopDestinations();
      if (res.data.destinations) {
        // Randomize the order for a fresh landing feel every time
        const shuffled = [...res.data.destinations].sort(() => Math.random() - 0.5);
        setTopDestinations(shuffled);
        console.log(res.data.cached ? "📡 [TOP DEST] Loaded from DB (Randomized Order)" : "✨ [TOP DEST] Fresh AI Refresh");
      }
    } catch (err) {
      console.error('Failed to load top destinations:', err);
    } finally {
      setTopLoading(false);
    }
  };

  // ⚡ Show cached data instantly, but refresh from backend if stale (>12h)
  const loadDestinations = async () => {
    let usedLocalCache = false;
    try {
      const stored = await AsyncStorage.getItem(DEST_KEY);
      const storedTs = await AsyncStorage.getItem(DEST_TS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const isCorrupt = parsed?.some((d: any) => 
          String(d.title || d.name).toLowerCase().includes('undefined') || 
          String(d.location).toLowerCase().includes('undefined')
        );
        
        if (parsed?.length > 0 && !isCorrupt) {
          setDestinations(parsed);
          setLoading(false);
          usedLocalCache = true;

          // Check if local cache is still fresh (< 12 hours old)
          const cacheAge = storedTs ? (Date.now() - parseInt(storedTs, 10)) : Infinity;
          if (cacheAge < LOCAL_CACHE_TTL) {
            console.log(`📦 [HIDDEN GEMS] Local cache is fresh (${(cacheAge / 3600000).toFixed(1)}h old). Skipping backend call.`);
            return;
          }
          console.log(`⏰ [HIDDEN GEMS] Local cache is stale (${(cacheAge / 3600000).toFixed(1)}h old). Fetching fresh data in background...`);
        }
      }
    } catch (e) {}

    if (!usedLocalCache) setLoading(true);
    try {
      const res = await aiAPI.generateDestinations();
      const apiData = res.data.destinations || [];
      console.log(res.data.cached ? "📡 [HIDDEN GEMS] Loaded from DB (12h Cache)" : "🚀 [HIDDEN GEMS] Loaded from Gemini AI Magic");
      
      if (apiData.length > 0) {
        setDestinations(apiData);
        await AsyncStorage.setItem(DEST_KEY, JSON.stringify(apiData));
        await AsyncStorage.setItem(DEST_TS_KEY, String(Date.now()));
      }
    } catch (err) {
      console.error('Failed to fetch destinations:', err);
      // If we have no data, we can try to show stale data as a last resort
      if (!usedLocalCache) {
        const stored = await AsyncStorage.getItem(DEST_KEY);
        if (stored) setDestinations(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔄 SHUFFLE — force backend to regenerate fresh hidden gems via AI
  const shuffleDestinations = async () => {
    setLoading(true);
    setDestinations([]);
    try {
      const res = await aiAPI.generateDestinations(true);
      const apiData = res.data.destinations || [];
      if (apiData.length > 0) {
        setDestinations(apiData);
        await AsyncStorage.setItem(DEST_KEY, JSON.stringify(apiData));
        await AsyncStorage.setItem(DEST_TS_KEY, String(Date.now()));
      }
    } catch (err) {
      // Restore old data on failure
      const stored = await AsyncStorage.getItem(DEST_KEY);
      if (stored) setDestinations(JSON.parse(stored));
      Alert.alert("Shuffle Failed", "Showing previous destinations.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDestination = async (item: any) => {
    if (!isAuthenticated) {
      return navigation.navigate('Login');
    }
    
    const saveTitle = item.name || item.title;
    const isCurrentlySaved = savedIds.includes(saveTitle);

    if (isCurrentlySaved) {
      dispatch(removeSaved(saveTitle));
      showToast('Removed', 'Destination removed from bucket list', 'info');
      try {
        const res = await userAPI.deleteSavedDestination(saveTitle);
        dispatch(updateUser({ savedDestinations: res.data.savedDestinations }));
      } catch (err) {
        console.error('Failed to remove:', err);
      }
      return;
    }

    const finalTitle = item.name || item.title || 'Exploring India';
    const finalImg = item.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1000&auto=format&fit=crop';

    const bucketItem = {
      id: saveTitle,
      title: finalTitle,
      image: finalImg,
      location: item.location || item.name || 'Adventure Hub',
      description: item.description || `Explore the hidden beauty of ${finalTitle}.`,
      bestTime: item.bestTime,
      tags: item.tags || [],
      whyLoveThis: item.whyLoveThis || [],
      nearestAirport: item.nearestAirport,
      nearestCity: item.nearestCity,
      travelTip: item.travelTip,
      lat: item.lat,
      lng: item.lng,
      rating: 4.8,
      budget: item.budget || 'Flexible'
    };

    dispatch(addSaved(bucketItem));
    showToast('Saved!', 'Added to your bucket list ✨', 'success');
    try {
      const res = await userAPI.saveDestination(bucketItem);
      dispatch(updateUser({ savedDestinations: res.data.savedDestinations }));
    } catch (err: any) {
      if (err.response?.status !== 400) {
        dispatch(removeSaved(saveTitle));
        console.error(err);
      }
    }
  };

  return (
    <ScreenWrapper withTopInset={false} withBottomInset={false}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Explore Hidden Gems</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={loading ? [1,2,3,4,5,6] : destinations}
        keyExtractor={(item, index) => {
          if (loading) return `skel-${index}`;
          const baseKey = item.id || item._id || item.name || item.title || 'dest';
          return `${baseKey}-${index}`;
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>🏛️ Top Indian Destinations</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
              {topLoading ? (
                [1,2,3,4].map((_, i) => (
                  <View key={i} style={[styles.topCard, { backgroundColor: theme.card, opacity: 0.5, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image" size={30} color={theme.border} />
                  </View>
                ))
              ) : (
                topDestinations.map((place, idx) => (
                  <TopDestinationItem 
                    key={place.id || `top-${idx}`}
                    place={place}
                    theme={theme}
                    navigation={navigation}
                    styles={styles}
                  />
                ))
              )}
            </ScrollView>
            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>🌿 AI-Curated Hidden Gems</Text>
          </View>
        }
        renderItem={({ item, index }) => 
          loading ? (
            <SkeletonCard theme={theme} styles={styles} />
          ) : (
            <FlipDestinationCard 
              item={item} 
              theme={theme} 
              index={index} 
              onSave={handleSaveDestination} 
              isSaved={savedIds.includes(item.name || item.title)}
              styles={styles}
            />
          )
        }
        ListFooterComponent={
          !loading && destinations.length > 0 ? (
            <TouchableOpacity 
              style={[styles.refreshBtn, { backgroundColor: theme.tealLight + '20' }]}
              onPress={shuffleDestinations}
            >
              <Ionicons name="sparkles" size={20} color={theme.teal} />
              <Text style={[styles.refreshBtnText, { color: theme.teal }]}>Magic Shuffle Gems ✨</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ height: 40 }} />
          )
        }
      />
    </View>
    </ScreenWrapper>
  );
};

const getStyles = (theme: any, insets: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, 
    paddingTop: Math.max(insets.top, 16),
    paddingBottom: SPACING.sm,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '800' },
  list: { padding: SPACING.md, paddingBottom: 40 },
  cardContainer: { marginBottom: SPACING.lg },
  cardWrapper: {
    height: 420,
    width: '100%',
  },
  flipCard: {
    width: '100%', height: '100%',
    position: 'absolute',
    backfaceVisibility: 'hidden',
  },
  card: {
    borderRadius: 24, overflow: 'hidden',
    ...SHADOW.lg,
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  frontGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '60%', justifyContent: 'flex-end', padding: 20,
  },
  frontTextContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  frontName: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  frontLocation: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginLeft: 4 },
  saveBtnFront: {
    position: 'absolute', top: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8,
    zIndex: 999,
  },
  
  // Back Side Styles
  backScrollContent: { padding: 20, paddingBottom: 80 },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  backHeader: { marginBottom: 15 },
  backTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  locationRowBack: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backLocationLabel: { fontSize: 13, fontWeight: '700' },
  ratingRowBack: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingTextBack: { fontSize: 13, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(150,150,150,0.1)', marginVertical: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8, color: COLORS.teal },
  descContainer: { marginBottom: 24 },
  backDescription: { fontSize: 15, lineHeight: 24 },
  
  whySection: { marginBottom: 24 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  reasonText: { fontSize: 14, fontWeight: '500' },
  
  insightRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  insightBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 16 },
  insightValue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagTextSmall: { fontSize: 11, fontWeight: '600', color: COLORS.teal },
  
  travelInfoSection: { marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoText: { fontSize: 13, fontWeight: '600' },
  
  tipBox: { backgroundColor: COLORS.teal + '10', padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: COLORS.teal },
  tipText: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },

  backActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: 20, gap: 10,
    backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)'
  },
  mapBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: 15, gap: 8, backgroundColor: COLORS.teal,
    ...SHADOW.md
  },
  mapBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  saveToggleBtn: {
     flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
     height: 50, borderRadius: 15, borderWidth: 1.5, gap: 6
  },
  saveToggleText: { fontSize: 13, fontWeight: '800' },

  // Refresh
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, marginTop: SPACING.md, marginBottom: SPACING.xl, gap: 8,
  },
  refreshBtnText: { fontSize: 16, fontWeight: '800' },
  
  // Skeleton Styles
  skeletonImage: { height: 420, width: '100%' },

  // Top Destinations Section
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  topCard: {
    width: 160, height: 200, borderRadius: 18, marginRight: 12,
    overflow: 'hidden', ...SHADOW.md,
  },
  topCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  topCardGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 90, padding: 10, justifyContent: 'flex-end',
  },
  topCardName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  topCardLocation: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  topCardRating: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6,
    paddingVertical: 3, borderRadius: 8,
  },
  topCardRatingText: { color: '#FFD700', fontSize: 10, fontWeight: '700' },
});

export default AllDestinationsScreen;
