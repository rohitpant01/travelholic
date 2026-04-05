import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  ActivityIndicator,
  Share,
  Platform,
  Linking
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOW } from '../utils/theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { addSaved, removeSaved } from '../store/slices/savedSlice';
import { updateUser } from '../store/slices/authSlice';
import apiClient from '../api/client';
import { userAPI } from '../api/services';
// import { BlurView } from 'expo-blur';
import PlannerCard from '../components/PlannerCard';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

interface ItineraryItem {
  time: string;
  placeName: string;
  address: string;
  distance: string;
  why: string;
  secretStory: string;
  coordinates: { lat: number; lng: number };
  rating: number;
  photoReference?: string | null;
}

interface DayPlannerParams {
  query: string;
  moods: string[];
  lat: number;
  lng: number;
}

const DayPlannerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { query, moods, lat, lng } = route.params as DayPlannerParams;
  const dispatch = useDispatch();
  const savedDestinations = useSelector((state: RootState) => state.saved.destinations);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Animation values for each card - initialize more than 3 for safety
  const [flipAnimations] = useState(() => Array.from({ length: 15 }, () => new Animated.Value(0)));

  useEffect(() => {
    generatePlan();
  }, []);

  const generatePlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/itinerary/generate', {
        params: { query, lat, lng, moods }
      });
      setPlan(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate your magic plan.');
    } finally {
      setLoading(false);
    }
  };

  const flipCard = (index: number) => {
    const isAlreadyFlipped = flippedIndex === index;
    
    Animated.spring(flipAnimations[index], {
      toValue: isAlreadyFlipped ? 0 : 180,
      useNativeDriver: true,
      friction: 8,
      tension: 10
    }).start();

    setFlippedIndex(isAlreadyFlipped ? null : index);
  };

  const handleToggleFavorite = async (place: any) => {
    const id = place.placeName;
    const isSaved = savedDestinations.some((p: any) => (p.name || p.title || p.id) === id);

    try {
      if (isSaved) {
        dispatch(removeSaved(id));
        if (isAuthenticated) {
          // If we have a mongoId, use it; otherwise fallback to title
          const itemInSaved = savedDestinations.find((p: any) => (p.name || p.title || p.id) === id);
          const deleteId = itemInSaved?._id || id;
          const res = await userAPI.deleteSavedDestination(deleteId);
          dispatch(updateUser({ savedDestinations: res.data.savedDestinations }));
        }
      } else {
        const destinationToSave = {
          id: place.placeName,
          name: place.placeName,
          title: place.placeName,
          address: place.address,
          rating: place.rating,
          photoReference: place.photoReference,
          location: place.address, // Safety check I added earlier
          image: place.photoReference 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photoReference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ''}`
            : 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80',
          description: place.why,
          coordinates: place.coordinates
        };

        dispatch(addSaved(destinationToSave));
        
        if (isAuthenticated) {
          const res = await userAPI.saveDestination(destinationToSave);
          dispatch(updateUser({ savedDestinations: res.data.savedDestinations }));
        }
      }
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
      // Revert local Redux if API failed?
      // Optional: showToast('Error', 'Failed to save', 'error');
    }
  };

  const openInMaps = (item: ItineraryItem) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${item.coordinates.lat},${item.coordinates.lng}`;
    const label = item.placeName;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    Linking.openURL(url!);
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isSaved = savedDestinations.some((p: any) => (p.name || p.title) === item.placeName);
    
    return (
      <View style={styles.cardRow}>
        <View style={styles.timeLabel}>
          <Text style={styles.timeText}>{item.time}</Text>
          <View style={styles.timeDot} />
          <View style={styles.timeLine} />
        </View>

        <View style={styles.cardWrapper}>
          <PlannerCard 
            item={item}
            index={index}
            isSaved={isSaved}
            onToggleFavorite={handleToggleFavorite}
            onNavigate={openInMaps}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loadingText}>Generating Magic... ✨</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={generatePlan}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[COLORS.teal, '#014d4e']}
        style={styles.headerGradient}
      >
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Day Planner</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.headerLabel}>Curated for your mood</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setIsSummaryExpanded(!isSummaryExpanded)}>
            <Text style={styles.summaryText} numberOfLines={isSummaryExpanded ? undefined : 2}>
              {plan?.whyThisPlan}
            </Text>
            {plan?.whyThisPlan?.length > 100 && (
              <Text style={styles.seeMoreText}>
                {isSummaryExpanded ? 'See Less' : 'See More'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Animated.FlatList
        data={plan?.itinerary || []}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => (
          <TouchableOpacity 
            style={styles.shareBtn} 
            onPress={() => Share.share({ message: `Check out my EkalGo plan! ${plan?.whyThisPlan}` })}
          >
            <Ionicons name="share-social" size={20} color={COLORS.white} />
            <Text style={styles.shareText}>Share Original Plan</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: COLORS.teal,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  errorText: {
    fontSize: 16,
    color: '#1A1A2E',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 25,
  },
  retryBtn: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: COLORS.teal,
    borderRadius: 25,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: Platform.OS === 'ios' ? 'Outfit-Bold' : 'Roboto',
  },
  headerContent: {
    paddingHorizontal: 25,
    marginTop: 20,
  },
  headerLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 5,
    opacity: 0.9,
  },
  seeMoreText: {
    color: '#FFD700', // Premium Gold accent
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  scroll: {
    flex: 1,
    marginTop: -30,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 40,
    paddingHorizontal: 15,
  },
  cardRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timeLabel: {
    width: 65,
    alignItems: 'center',
    paddingTop: 15,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00B4B4',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  timeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00B4B4',
    borderWidth: 3,
    borderColor: '#fff',
    zIndex: 2,
  },
  timeLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(0,180,180,0.15)',
    marginTop: -5,
  },
  cardWrapper: {
    flex: 1,
    paddingBottom: 25,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00B4B4',
    marginTop: 10,
    marginBottom: 30,
    paddingVertical: 16,
    borderRadius: 16,
    ...SHADOW.md,
  },
  shareText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
  }
});

export default DayPlannerScreen;
