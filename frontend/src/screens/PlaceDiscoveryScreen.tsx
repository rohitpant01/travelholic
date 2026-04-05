import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Image, ScrollView,
  TouchableOpacity, Dimensions, Animated, Modal,
  Keyboard, Platform, Linking, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { placeService, Place, CategorizedPlaces } from '../api/placeService';
import { userAPI, aiAPI } from '../api/services';
import { useDispatch, useSelector } from 'react-redux';
import { getDiscoveryCache, saveDiscoveryCache } from '../utils/bucketListUtils';
import { addSaved } from '../store/slices/savedSlice';
import FlipCard from 'react-native-flip-card';
import MapView, { Marker } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

const MOODS_LIST = [
  { id: 'romantic', label: 'Romantic', emoji: '❤️' },
  { id: 'spiritual', label: 'Spiritual', emoji: '🕍' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'adventure', label: 'Adventure', emoji: '🧗' },
  { id: 'fun', label: 'Fun', emoji: '🎡' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { id: 'foodie', label: 'Foodie', emoji: '🍽️' },
  { id: 'culture', label: 'Culture', emoji: '🏛️' },
];

const CATEGORY_MAP: { key: keyof CategorizedPlaces, label: string, emoji: string }[] = [
  { key: 'others', label: 'Must See & Others', emoji: '✨' },
  { key: 'romantic', label: 'Romantic Spots', emoji: '❤️' },
  { key: 'spiritual', label: 'Spiritual Places', emoji: '🕍' },
  { key: 'nature', label: 'Nature & Escapes', emoji: '🌿' },
  { key: 'adventure', label: 'Adventure & Thrills', emoji: '⛰️' },
  { key: 'fun', label: 'Fun & Activities', emoji: '🎡' },
  { key: 'family', label: 'Family & Group Fun', emoji: '👨‍👩‍👧‍👦' },
  { key: 'restaurants', label: 'Top Dining', emoji: '🍽️' },
  { key: 'cafes', label: 'Cozy Cafes', emoji: '☕' },
  { key: 'hotels', label: 'Great Stays', emoji: '🏨' },
];

const QUOTES = [
  "✨ From solo trips to shared memories.",
  "🗺️ Escape the ordinary, discover the magic.",
  "🌟 Traveling: first it leaves you speechless, then it turns you into a storyteller.",
  "⛰️ Adventure is worthwhile in itself.",
  "📸 Collect moments, not things.",
  "🔭 Your next story starts here.",
  "🧭 Wander often, wonder always.",
  "🚀 Discovering the beauty in every corner of the world.",
  "✨ Travel is the only thing you buy that makes you richer.",
  "🌍 To travel is to live.",
];

const MarqueeLine = ({ text }: { text: string }) => {
  const theme = useAppTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.setValue(width);
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: -width * 2,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [text]);

  return (
    <View style={[styles.marqueeContainer, { backgroundColor: theme.tealLight + '30' }]}>
      <Animated.Text 
        numberOfLines={1} 
        style={[styles.marqueeText, { color: theme.teal, transform: [{ translateX: animatedValue }] }]}
      >
        {text}
      </Animated.Text>
    </View>
  );
};

const SkeletonCategory = () => {
  const theme = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.categorySection}>
      <Animated.View style={[styles.skeletonTitle, { backgroundColor: theme.borderLight, opacity }]} />
      <View style={{ flexDirection: 'row' }}>
        {[1, 2].map((i) => (
          <Animated.View key={i} style={[styles.card, styles.skeletonCard, { backgroundColor: theme.borderLight, opacity }]} />
        ))}
      </View>
    </View>
  );
};

const PlaceCard = ({ place, onMapPress }: { place: Place, onMapPress: () => void }) => {
  const theme = useAppTheme();
  const dispatch = useDispatch();
  const photoUrl = place.photoReference 
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photoReference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyByQ5WTuSA4F-eThrkdhcAgHoJyuI8k0fs'}`
    : 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80';

  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const fetchDetails = async () => {
    if (details || loading) return;
    setLoading(true);
    try {
      const res = await placeService.getPlaceDetails(
        place.id, 
        place.name, 
        place.address, 
        place.types[0] || 'point_of_interest',
        place.rating,
        place.distanceKm
      );
      if (res.data.success) {
        setDetails(res.data.details);
      }
    } catch (err) {
      console.error('Failed to fetch AI details', err);
    } finally {
      setLoading(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: any) => {
    e.stopPropagation();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const payload = {
        id: place.id,
        title: details?.title || place.name,
        image: photoUrl,
        location: details?.location || place.address,
        description: details?.hook_line || place.whyThisPlace,
        rating: place.rating || 0,
        bestTime: details?.quick_info?.find((i: string) => i.includes('Best time')) || 'Flexible',
        tags: details?.badges || [],
        lat: place.location.lat,
        lng: place.location.lng,
      };

      await userAPI.saveDestination(payload);
      dispatch(addSaved(payload));
      alert('Saved to your bucket list! ✨');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to save destination';
      if (msg.includes('already in bucket list')) {
        alert('Destination already saved! ❤️');
      } else {
        alert(msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FlipCard 
      style={styles.flipCard} 
      friction={8} 
      perspective={1000} 
      flipHorizontal={true} 
      flipVertical={false} 
      flip={isFlipped} 
      clickable={false}
    >
      {/* Front Side */}
      <TouchableOpacity 
        activeOpacity={1} 
        style={styles.container} 
        onPress={() => { setIsFlipped(true); if(!details) fetchDetails(); }}
      >
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Image source={{ uri: photoUrl }} style={styles.cardImage} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.cardGradient} />
          <View style={styles.cardContent}>
            <Text style={styles.placeName} numberOfLines={2}>{place.name}</Text>
            <View style={styles.addressRow}>
               <Ionicons name="map-outline" size={10} color="rgba(255,255,255,0.7)" />
               <Text style={styles.addressText} numberOfLines={1}>{place.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={12} color="#FFF" />
              <Text style={styles.infoText} numberOfLines={1}>{place.distanceText || 'Calculating...'}</Text>
            </View>
            <View style={styles.whyBatch}>
              <Text style={styles.whyText} numberOfLines={1}>{place.whyThisPlace}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Back Side */}
      <View style={[styles.card, styles.cardBack, { backgroundColor: theme.card }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setIsFlipped(false)}>
          <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.backHeader}>
            <Text style={styles.backTitle} numberOfLines={1}>{details?.title || place.name}</Text>
            <Text style={styles.backSubTitle} numberOfLines={1}>{details?.location || place.address.split(',')[0]}</Text>
            <Ionicons name="chevron-down" size={12} color="#FFF" style={{ marginTop: 2, opacity: 0.8 }} />
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.backBody}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.magicText, { color: theme.teal }]}>EkalGo Magic 🪄</Text>
              <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 4 }}>Gathering AI insights...</Text>
            </View>
          ) : details ? (
            <View style={{ flex: 1 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.hookLine, { color: theme.text }]}>{details.hook_line}</Text>
                
                <View style={styles.quickInfoGrid}>
                  {details.quick_info?.map((info: string, idx: number) => (
                    <View key={idx} style={styles.infoPill}>
                      <Text style={[styles.infoPillText, { color: theme.textSecondary }]}>{info}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.badgeRow}>
                  {details.badges?.filter((b: string) => !b.toUpperCase().includes('AI RECOMMENDED'))
                    .map((badge: string, idx: number) => (
                    <View key={idx} style={[styles.badge, { backgroundColor: theme.tealLight + '20' }]}>
                      <Text style={[styles.badgeText, { color: theme.teal }]}>{badge}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.actionGrid}>
                <TouchableOpacity 
                  style={[styles.smallActionBtn, { backgroundColor: theme.teal }]} 
                  onPress={(e) => { e.stopPropagation(); onMapPress(); }}
                >
                  <Ionicons name="navigate-outline" size={14} color="#FFF" />
                  <Text style={styles.smallActionText}>Go</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.smallActionBtn, { backgroundColor: theme.card, borderColor: theme.teal, borderWidth: 1 }]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Ionicons name={isSaving ? "sync" : "heart-outline"} size={14} color={theme.teal} />
                  <Text style={[styles.smallActionText, { color: theme.teal }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.loadingContainer} onPress={fetchDetails}>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>Tap to reveal magic ✨</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </FlipCard>
  );
};

export default function PlaceDiscoveryScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<CategorizedPlaces | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationName, setLocationName] = useState('Nearby');
  const [isMapView, setIsMapView] = useState(false);
  const [searchCenter, setSearchCenter] = useState<{lat: number, lng: number} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('others');
  
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});
  
  // Mood Selection Modal
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // Travel Quotes Rotation
  const [quoteIndex, setQuoteIndex] = useState(Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % QUOTES.length);
    }, 15000); // Sync with marquee duration
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      // 1. Load Cache Immediately
      const cache = await getDiscoveryCache();
      if (cache) {
        setPlaces(cache.results);
        setLocationName(cache.locationName);
      }

      // 2. Begin Background Sync
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setSearchCenter({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      handleSearch('', loc.coords.latitude, loc.coords.longitude, !!cache);
    })();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '' && !loading && location) {
      handleSearch('', location.coords.latitude, location.coords.longitude);
    }
  }, [searchQuery]);

  const handleSearch = async (query: string, lat?: number, lng?: number, silent = false) => {
    const sLat = lat || location?.coords.latitude;
    const sLng = lng || location?.coords.longitude;
    if (!sLat || !sLng) return;

    if (silent) setIsSyncing(true);
    else setLoading(true);

    Keyboard.dismiss();

    try {
      const res = await placeService.searchNearMe(query, sLat, sLng);
      setPlaces(res.data.results);
      setLocationName(res.data.locationName || (res.data.isCitySearch ? query : 'Nearby'));
      
      // Persist to local cache for instant-on next time
      saveDiscoveryCache(res.data.results, res.data.locationName || (res.data.isCitySearch ? query : 'Nearby'));

      const firstArray = Object.values(res.data.results).find(arr => arr && arr.length > 0);
      if (firstArray && firstArray.length > 0 && res.data.isCitySearch) {
         setSearchCenter(firstArray[0].location);
      } else {
         setSearchCenter({ lat: sLat, lng: sLng });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const handleViewOnMap = (item: Place) => {
    const { lat, lng } = item.location;
    const label = encodeURIComponent(item.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    });
    Linking.openURL(url!);
  };

  const handleCategoryPress = (cat: typeof CATEGORY_MAP[0]) => {
    if (searchQuery.trim() === '' && sectionPositions.current[cat.key] !== undefined) {
      scrollRef.current?.scrollTo({ y: sectionPositions.current[cat.key], animated: true });
      setActiveTab(cat.key);
    } else {
      handleSearch(cat.label);
    }
  };

  const toggleMood = (id: string) => {
    if (selectedMoods.includes(id)) {
      setSelectedMoods(selectedMoods.filter(m => m !== id));
    } else {
      setSelectedMoods([...selectedMoods, id]);
    }
  };

  const generateAIPlan = () => {
    if (selectedMoods.length === 0) return;
    setMoodModalVisible(false);
    
    // Pass mandatory lat/lng from state
    const targetLat = searchCenter?.lat || location?.coords.latitude;
    const targetLng = searchCenter?.lng || location?.coords.longitude;

    if (!targetLat || !targetLng) {
      alert("Locating you... Please wait a moment. 📍");
      return;
    }

    navigation.navigate('DayPlanner', { 
      query: searchQuery || locationName || 'Nearby', 
      moods: selectedMoods,
      lat: targetLat,
      lng: targetLng
    });
  };

  const allPlaces = React.useMemo(() => {
    if (!places) return [];
    const flattened = Object.values(places).flat().filter(p => !!p);
    // Deduplicate by ID
    const unique = [];
    const seen = new Set();
    for (const p of flattened) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }
    return unique;
  }, [places]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>Explorer</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isSyncing && (
              <Animated.View style={{ marginRight: 8 }}>
                <Ionicons name="sparkles" size={14} color={theme.teal} />
              </Animated.View>
            )}
            <View style={[styles.locationBadge, { backgroundColor: theme.tealLight + '20' }]}>
               <Ionicons name="location" size={12} color={theme.teal} />
               <Text style={[styles.locationBadgeText, { color: theme.teal }]}>{locationName}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Discovering curated spots {locationName === 'Nearby' ? 'near you' : `in ${locationName}`}
        </Text>

        <View style={[styles.searchRow, { gap: 12 }]}>
          <View style={[styles.searchContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textLight} />
            <TextInput
              placeholder="Search city like Dehradun..."
              placeholderTextColor={theme.textLight + '90'}
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch(searchQuery)}
              autoCapitalize="sentences"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 8 }}>
                <Ionicons name="close-circle" size={18} color={theme.textLight} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.planBtnCircular, { backgroundColor: theme.teal }]} 
            onPress={() => setMoodModalVisible(true)}
          >
            <Ionicons name="sparkles" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* NEW SCROLLABLE CATEGORY BAR */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.categoryBar}
          contentContainerStyle={styles.categoryBarContent}
        >
          {CATEGORY_MAP.map((cat) => (
            <TouchableOpacity 
              key={cat.key} 
              style={[
                styles.categoryTab, 
                { backgroundColor: activeTab === cat.key ? theme.teal : theme.tealLight + '20' }
              ]}
              onPress={() => handleCategoryPress(cat)}
            >
              <Text style={[
                styles.categoryTabText, 
                { color: activeTab === cat.key ? '#FFF' : theme.teal }
              ]}>{cat.emoji} {cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <MarqueeLine text={QUOTES[quoteIndex]} />
      </View>

      <TouchableOpacity 
        style={[styles.floatingMapBtn, { backgroundColor: theme.teal }]}
        onPress={() => setIsMapView(!isMapView)}
      >
        <Ionicons name={isMapView ? "list" : "map"} size={20} color="#FFF" />
        <Text style={styles.floatingMapBtnText}>{isMapView ? "List View" : "Map View"}</Text>
      </TouchableOpacity>

      {isMapView && searchCenter ? (
        <MapView 
           style={styles.map}
           initialRegion={{
             latitude: searchCenter.lat,
             longitude: searchCenter.lng,
             latitudeDelta: 0.1,
             longitudeDelta: 0.1,
           }}
        >
          {allPlaces.map((p, idx) => (
             <Marker 
               key={p.id || idx} 
               coordinate={{ latitude: p.location.lat, longitude: p.location.lng }}
               title={p.name}
               description={p.distanceText}
             />
          ))}
        </MapView>
      ) : (
        <ScrollView 
          ref={scrollRef}
          style={styles.listContainer} 
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {loading ? (
            <View>
               <SkeletonCategory />
               <SkeletonCategory />
               <SkeletonCategory />
            </View>
          ) : places ? (
            CATEGORY_MAP.map((cat) => {
              const catPlaces = (places as any)[cat.key];
              if (!catPlaces || catPlaces.length === 0) return null;
              
              return (
                <View 
                  key={cat.key} 
                  style={styles.categorySection}
                  onLayout={(e) => {
                    sectionPositions.current[cat.key] = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.categoryHeader}>
                    <Text style={[styles.categoryTitle, { color: theme.text }]}>
                      {cat.emoji} {cat.label}
                    </Text>
                    {cat.key === 'others' && (
                      <TouchableOpacity 
                        onPress={() => {
                          const visibleIds = Object.values(places as any)
                            .flatMap((arr: any) => (arr || []).slice(0, 6))
                            .map((p: any) => p.id);
                          
                          navigation.navigate('CategoryDetails', { 
                            title: `${cat.emoji} ${cat.label}`, 
                            places: catPlaces,
                            excludeIds: visibleIds
                          });
                        }}
                      >
                        <Text style={[styles.showMore, { color: theme.teal }]}>Show More</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                    data={catPlaces.slice(0, 6)}
                    keyExtractor={(item) => `${cat.key}-${item.id}`}
                    renderItem={({ item }) => <PlaceCard place={item} onMapPress={() => handleViewOnMap(item)} />}
                  />
                </View>
              );
            })
          ) : null}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Mood Selection Modal */}
      <Modal visible={moodModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>How's your mood today? ✨</Text>
              <TouchableOpacity onPress={() => setMoodModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Select multiple moods for your personalized Groq AI itinerary.
            </Text>

            <View style={styles.moodGrid}>
              {MOODS_LIST.map((mood) => {
                const isSelected = selectedMoods.includes(mood.id);
                return (
                  <TouchableOpacity 
                    key={mood.id} 
                    style={[
                      styles.moodItem, 
                      { backgroundColor: isSelected ? theme.teal : theme.background, borderColor: theme.border }
                    ]}
                    onPress={() => toggleMood(mood.id)}
                  >
                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                    <Text style={[styles.moodLabel, { color: isSelected ? '#FFF' : theme.text }]}>{mood.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={[styles.modalActionBtn, { backgroundColor: selectedMoods.length > 0 ? theme.teal : theme.borderLight }]}
              onPress={generateAIPlan}
              disabled={selectedMoods.length === 0}
            >
              <Text style={styles.modalActionBtnText}>EkalGo Magic 🪄</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: SPACING.lg, paddingBottom: 15, ...SHADOW.md, zIndex: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  locationBadgeText: { fontSize: 10, fontWeight: '800', marginLeft: 4, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 13, marginBottom: 15, fontWeight: '600' },
  marqueeContainer: { height: 32, justifyContent: 'center', borderRadius: 8, overflow: 'hidden', marginTop: 4, paddingHorizontal: 10 },
  marqueeText: { fontSize: 13, fontWeight: '700', lineHeight: 20, textAlignVertical: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  searchContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingLeft: 12, 
    paddingRight: 6, 
    height: 52, 
    borderRadius: 15, 
    borderWidth: 1.5 
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, height: '100%' },
  planBtnCircular: { 
    width: 52, 
    height: 52, 
    borderRadius: 26, 
    alignItems: 'center', 
    justifyContent: 'center', 
    ...SHADOW.md 
  },
  
  floatingMapBtn: {
    position: 'absolute', bottom: 30, right: 20, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 30, ...SHADOW.lg
  },
  floatingMapBtnText: { color: '#FFF', fontWeight: '800', marginLeft: 8, fontSize: 14 },
  
  categoryBar: { marginTop: 12, marginBottom: 8 },
  categoryBarContent: { paddingRight: 20 },
  categoryTab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 10 },
  categoryTabText: { fontSize: 13, fontWeight: '800' },

  map: { width: '100%', height: '100%' },
  
  listContainer: { flex: 1, paddingTop: 10 },
  categorySection: { marginBottom: 25 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 12 },
  categoryTitle: { fontSize: 20, fontWeight: '800' },
  showMore: { fontSize: 13, fontWeight: '700' },
  horizontalList: { paddingHorizontal: 15 },
  skeletonTitle: { width: 150, height: 24, borderRadius: 12, marginLeft: 20, marginBottom: 12 },
  skeletonCard: { width: width * 0.65, height: 220, marginLeft: 15 },
  
  flipCard: { width: width * 0.75, height: 380, marginHorizontal: 8 },
  card: { flex: 1, borderRadius: 24, overflow: 'hidden', ...SHADOW.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardBack: { padding: 0 },
  backHeader: { paddingVertical: 12, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', height: 60 },
  backTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  backSubTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' },
  backBody: { padding: 15, flex: 1 },
  
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  magicText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  
  hookLine: { fontSize: 13, fontWeight: '700', fontStyle: 'italic', textAlign: 'center', marginBottom: 8, lineHeight: 18 },
  quickInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  infoPill: { backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  infoPillText: { fontSize: 10, fontWeight: '700' },
  
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  smallActionBtn: { 
    flex: 1, 
    minWidth: '45%', 
    height: 36, 
    borderRadius: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 5 
  },
  smallActionText: { fontSize: 11, fontWeight: '800' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 'auto' },
  actionBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  cardImage: { width: '100%', height: '100%', position: 'absolute' },
  cardGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  cardContent: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  placeName: { fontSize: 16, fontWeight: '900', color: '#FFF', marginBottom: 2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 },
  addressText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', marginLeft: 5 },
  whyBatch: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, alignSelf: 'flex-start' },
  whyText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, marginTop: 10 },
  mapBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800', marginLeft: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: RADIUS.xl * 2, borderTopRightRadius: RADIUS.xl * 2, padding: 25, minHeight: height * 0.6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  modalSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 25, fontWeight: '600' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 30 },
  moodItem: { width: (width - 74) / 2, padding: 15, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: 'center', flexDirection: 'row', gap: 10 },
  moodEmoji: { fontSize: 18 },
  moodLabel: { fontSize: 14, fontWeight: '800' },
  modalActionBtn: { paddingVertical: 18, borderRadius: RADIUS.xl, alignItems: 'center', ...SHADOW.lg },
  modalActionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});
