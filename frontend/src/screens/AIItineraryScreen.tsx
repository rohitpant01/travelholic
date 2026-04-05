import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Platform, Dimensions, Image, Linking, Animated
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FlipCard from 'react-native-flip-card';
import { useAppTheme, FONTS, RADIUS, SPACING, SHADOW } from '../utils/theme';
import { useDispatch, useSelector } from 'react-redux';
import { aiAPI, userAPI } from '../api/services';
import { addSaved } from '../store/slices/savedSlice';
import { placeService } from '../api/placeService';
import { fetchPlaceImage } from '../api/imageService';

const { width: W } = Dimensions.get('window');

// --- SHIMMER LOADER COMPONENT ---
const ShimmerLoader = () => {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.container}>
      <View style={[styles.heroHeader, { backgroundColor: '#eee' }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#ddd', opacity }]} />
      </View>
      <View style={{ padding: 20 }}>
        <Animated.View style={[styles.shimmerLine, { width: '80%', opacity }]} />
        <Animated.View style={[styles.shimmerLine, { width: '50%', opacity, height: 40, marginTop: 20 }]} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
          {[1,2,3].map(i => <Animated.View key={i} style={[styles.shimmerChip, { opacity }]} />)}
        </View>
        {[1,2].map(i => (
          <View key={i} style={{ marginTop: 30, flexDirection: 'row', gap: 15 }}>
            <Animated.View style={{ width: 4, height: 100, backgroundColor: '#eee' }} />
            <Animated.View style={{ flex: 1, height: 100, borderRadius: 16, backgroundColor: '#eee', opacity }} />
          </View>
        ))}
      </View>
    </View>
  );
};

// --- MODERN ACTIVITY ITEM ---
const PlanItem = ({ item, index, isLast, navigation, destination }: any) => {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const [img, setImg] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    const load = async () => {
      const url = await fetchPlaceImage(item.place || item.activity);
      if (url) setImg(url);
    };
    load();
  }, [item]);

  const fetchDetails = async () => {
    if (details || loadingDetails) return;
    setLoadingDetails(true);
    try {
      const res = await placeService.getPlaceDetails(
        item.place_id || 'manual', 
        item.place || item.activity, 
        destination, 
        'activity',
        4.5,
        item.distance
      );
      if (res.data.success) {
        setDetails(res.data.details);
      }
    } catch (err) {
      console.error('Failed to fetch AI stories', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = {
        id: item.place_id || `itinerary_${index}`,
        title: item.place || item.activity,
        image: img || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828',
        location: destination,
        description: item.description,
        rating: 4.5,
        lat: item.lat,
        lng: item.lng,
      };
      await userAPI.saveDestination(payload);
      dispatch(addSaved(payload));
      alert('Saved to your bucket list! ✨');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to save destination';
      alert(msg.includes('already in') ? 'Destination already saved! ❤️' : msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFlip = () => {
    if (!isFlipped && !details) fetchDetails();
    setIsFlipped(!isFlipped);
  };

  const handlePress = () => {
    navigation.navigate('PlaceDetails', { 
      place: {
        title: item.place,
        name: item.place,
        description: item.description,
        cost: item.cost,
        travel_time: item.travel_time,
        distance: item.distance,
        location: item.place,
        lat: item.lat,
        lng: item.lng,
        destination: destination,
        story: item.description,
        bestTime: "Year round"
      }
    });
  };

  return (
    <View key={index} style={styles.stepCard}>
      <View style={styles.stepTimeline}>
        <View style={styles.timelineDot} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      
      <FlipCard 
        style={styles.stepFlip}
        friction={6}
        perspective={1000}
        flipHorizontal={true}
        flipVertical={false}
        flip={isFlipped}
        clickable={false}
      >
        {/* Face Side */}
        <TouchableOpacity 
          activeOpacity={0.9}
          style={styles.stepBody}
          onPress={handlePress}
        >
          <View style={styles.stepHeader}>
            <View style={styles.timeBadge}>
              <Ionicons name="time-outline" size={12} color="#fff" />
              <Text style={styles.timeBadgeText}>{item.time}</Text>
            </View>
            <Text style={styles.stepCost}>{item.cost || '₹0'}</Text>
          </View>
          
          <View style={styles.stepContentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepActivity} numberOfLines={1}>{item.place || item.activity}</Text>
              <Text style={styles.stepDesc} numberOfLines={3}>{item.description}</Text>
            </View>
            {img && <Image source={{ uri: img }} style={styles.stepThumb} />}
          </View>

          <View style={styles.stepFooter}>
            <TouchableOpacity 
              style={styles.metaBadge}
              onPress={(e) => { e.stopPropagation(); handleFlip(); }}
            >
              <Ionicons name="sync-outline" size={12} color={theme.teal} />
              <Text style={styles.metaText}>Flip</Text>
            </TouchableOpacity>
            <View style={styles.metaBadge}>
              <Ionicons name="walk-outline" size={12} color={theme.teal} />
              <Text style={styles.metaText}>{item.travel_time || '5 mins'}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="navigate-outline" size={12} color={theme.teal} />
              <Text style={styles.metaText}>{item.distance || '1 km'}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Back Side (Premium Upgrade) */}
        <View style={[styles.stepBody, styles.itineraryBack, { padding: 0 }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setIsFlipped(false)}>
            <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.backHeaderPremium}>
              <Text style={styles.backTitlePremium} numberOfLines={1}>{details?.title || item.place || item.activity}</Text>
              <Text style={styles.backSubTitlePremium} numberOfLines={1}>{details?.location || destination}</Text>
              <Ionicons name="chevron-down" size={12} color="#FFF" style={{ marginTop: 2, opacity: 0.8 }} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.backBodyPremium}>
            {loadingDetails ? (
              <View style={styles.loadingContainerSmall}>
                <ActivityIndicator size="small" color={theme.teal} />
                <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 4 }}>EkalGo Magic 🪄</Text>
              </View>
            ) : details ? (
              <View style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[styles.hookLineItinerary, { color: theme.text }]}>{details.hook_line}</Text>
                  
                  <View style={styles.quickInfoGridSmall}>
                    {details.quick_info?.map((info: string, idx: number) => (
                      <View key={idx} style={styles.infoPillSmall}>
                        <Text style={[styles.infoPillTextSmall, { color: theme.textSecondary }]}>{info}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.badgeRowSmall}>
                    {details.badges?.filter((b: string) => !b.toUpperCase().includes('AI RECOMMENDED'))
                      .map((badge: string, idx: number) => (
                      <View key={idx} style={[styles.badgeSmall, { backgroundColor: theme.tealLight + '20' }]}>
                        <Text style={[styles.badgeTextSmall, { color: theme.teal }]}>{badge}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.itineraryActionRow}>
                  <TouchableOpacity 
                    style={[styles.miniBtn, { backgroundColor: theme.teal }]} 
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`)}
                  >
                    <Ionicons name="navigate" size={14} color="#fff" />
                    <Text style={styles.miniBtnText}>Go</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.miniBtn, { borderColor: theme.teal, borderWidth: 1 }]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    <Ionicons name={isSaving ? "sync" : "heart"} size={14} color={theme.teal} />
                    <Text style={[styles.miniBtnText, { color: theme.teal }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
               <TouchableOpacity style={styles.loadingContainerSmall} onPress={fetchDetails}>
                  <Text style={{ fontSize: 10, color: theme.textSecondary }}>Tap for magic ✨</Text>
               </TouchableOpacity>
            )}
          </View>
        </View>
      </FlipCard>
    </View>
  );
};

// --- FLIP CARD FOR HIDDEN GEMS ---
const GemCard = ({ gem }: any) => {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const [img, setImg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const url = await fetchPlaceImage(gem.name);
      if (url) setImg(url);
    };
    load();
  }, [gem]);

  return (
    <FlipCard 
      style={styles.gemFlip}
      friction={6}
      perspective={1000}
      flipHorizontal={true}
      flipVertical={false}
      flip={false}
      clickable={true}
    >
      {/* Face Side */}
      <View style={styles.gemFace}>
        <Image source={{ uri: img || 'https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20' }} style={styles.gemImg} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gemGradient} />
        <View style={styles.gemOverlay}>
          <Text style={styles.gemName}>{gem.name}</Text>
          <View style={styles.gemRating}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.gemRatingText}>{gem.rating || '4.5'}</Text>
          </View>
        </View>
      </View>
      {/* Back Side */}
      <View style={styles.gemBack}>
        <Text style={styles.gemStoryTitle}>Secret Story</Text>
        <Text style={styles.gemStory}>{gem.story}</Text>
        <TouchableOpacity 
          style={styles.gemMapBtn}
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${gem.lat},${gem.lng}`)}
        >
          <Ionicons name="location" size={14} color="#fff" />
          <Text style={styles.gemMapText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </FlipCard>
  );
};

export default function AIItineraryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const theme = useAppTheme();
  const styles = getStyles(theme);

  const { trip } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [heroImg, setHeroImg] = useState<string | null>(null);

  useEffect(() => {
    generateItinerary();
  }, []);

  const generateItinerary = async () => {
    setLoading(true);
    try {
      const start = new Date(trip?.date || Date.now());
      const end = new Date(trip?.endDate || Date.now() + 86400000 * 5);
      const daysCount = Math.min(5, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // Extract from route params if trip is missing (Magic Circle flow)
      const { destination: pDest, interests: pInterests } = route.params || {};

      const res = await aiAPI.generateItinerary({
        destination: pDest || trip?.destination?.city || trip?.location?.city || 'India',
        days: daysCount,
        budget: trip?.budget || 'Moderate',
        interests: pInterests?.join(', ') || trip?.interests?.join(', ') || 'Culture, Nature',
        travelType: trip?.travelType || 'solo',
        startLocation: trip?.source?.city || 'Local'
      });
      
      setData(res.data);
      const img = await fetchPlaceImage(res.data.destination);
      if (img) setHeroImg(img);
    } catch (e) {
      Alert.alert('Magic Failed', 'AI was unable to reach the destination. Try again!');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ShimmerLoader />;

  const currentDayPlan = data?.itinerary[activeDay];
  const roadmapSteps = data?.roadmap?.split('->').map((s: string) => s.trim());

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]}>
        {/* HERO SECTION */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: heroImg || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828' }} style={styles.heroImg} />
          <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.8)']} style={styles.heroOverlay} />
          
          <TouchableOpacity style={styles.absBack} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.absShare} onPress={() => Share.share({ message: `Plan for ${data.destination}` })}>
            <Ionicons name="share-social-outline" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <Text style={styles.heroDest}>{data.destination}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Ionicons name="wallet-outline" size={14} color="#fff" />
                <Text style={styles.statText}>{data.estimated_total_cost}</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="calendar-outline" size={14} color="#fff" />
                <Text style={styles.statText}>{data.itinerary.length} Days</Text>
              </View>
            </View>
          </View>
        </View>

        {/* TOP SWIPABLE INFO CARDS */}
        {(data?.how_to_reach || data?.best_time_to_visit || data?.why_to_visit) ? (
          <View style={{ marginTop: 20 }}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}>
              
              {/* Card 1: How to Reach */}
              {data.how_to_reach && (
                <View style={[styles.insightCard, { width: W - 40, borderLeftColor: theme.teal, marginBottom: 0 }]}>
                   <View style={styles.insightIcon}>
                     <Ionicons name="airplane" size={18} color={theme.teal} />
                   </View>
                   <View style={{ flex: 1, justifyContent: 'center' }}>
                     <Text style={styles.insightLabel}>HOW TO REACH</Text>
                     <Text style={[styles.insightText, { marginTop: 6 }]}>{data.how_to_reach}</Text>
                   </View>
                </View>
              )}

              {/* Card 2: Travel Tips & Time */}
              {(data.best_time_to_visit || data.travel_tips) && (
                <View style={[styles.insightCard, { width: W - 40, borderLeftColor: '#FF9800', marginBottom: 0 }]}>
                   <View style={styles.insightIcon}>
                     <Ionicons name="calendar" size={18} color="#FF9800" />
                   </View>
                   <View style={{ flex: 1, justifyContent: 'center' }}>
                     <Text style={[styles.insightLabel, { color: '#FF9800' }]}>BEST TIME & TIPS</Text>
                     {data.best_time_to_visit && (
                       <Text style={[styles.insightText, { marginTop: 6, fontWeight: '800' }]}>{data.best_time_to_visit}</Text>
                     )}
                     {data.travel_tips?.slice(0, 2).map((tip: string, idx: number) => (
                       <View key={idx} style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                         <Ionicons name="checkmark-circle" size={14} color="#FF9800" />
                         <Text style={[styles.insightText, { flex: 1, marginTop: 0 }]}>{tip}</Text>
                       </View>
                     ))}
                   </View>
                </View>
              )}

              {/* Card 3: Why To Visit */}
              {data.why_to_visit && (
                <View style={[styles.insightCard, { width: W - 40, borderLeftColor: '#FF5A5F', marginBottom: 0 }]}>
                   <View style={styles.insightIcon}>
                     <Ionicons name="heart" size={18} color="#FF5A5F" />
                   </View>
                   <View style={{ flex: 1, justifyContent: 'center' }}>
                     <Text style={[styles.insightLabel, { color: '#FF5A5F' }]}>WHY YOU'LL LOVE IT</Text>
                     {data.why_to_visit?.slice(0, 3).map((reason: string, idx: number) => (
                       <View key={idx} style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
                         <Ionicons name="sparkles" size={14} color="#FF5A5F" />
                         <Text style={[styles.insightText, { flex: 1, marginTop: -2 }]}>{reason}</Text>
                       </View>
                     ))}
                   </View>
                </View>
              )}

            </ScrollView>
          </View>
        ) : null}

        {/* STICKY DAY TABS */}
        <View style={styles.stickyTabs}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.dayTabs}
            contentContainerStyle={styles.dayTabsContent}
          >
            {data?.itinerary.map((_: any, idx: number) => (
              <TouchableOpacity 
                key={idx} 
                onPress={() => setActiveDay(idx)}
                style={[styles.dayTab, activeDay === idx && styles.dayTabActive]}
              >
                <Text style={[styles.dayTabText, activeDay === idx && styles.dayTabTextActive]} numberOfLines={1}>
                  Day {idx + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ROADMAP PATH */}
        <View style={styles.roadmapSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {roadmapSteps?.map((city: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.pathChip}>
                  <Text style={styles.pathText}>{city}</Text>
                </View>
                {i < roadmapSteps.length - 1 && <Ionicons name="arrow-forward" size={14} color={theme.textLight} style={{ marginHorizontal: 8 }} />}
              </View>
            ))}
          </ScrollView>
        </View>


        {/* DAY CONTENT */}
        <View style={styles.pageContent}>
          {currentDayPlan?.daily_insight && (
            <View style={styles.insightCard}>
              <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.insightIcon}>
                <Ionicons name="bulb" size={16} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightLabel}>TRAVELER'S TIP</Text>
                <Text style={styles.insightText}>{currentDayPlan.daily_insight}</Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Daily Schedule</Text>
          {currentDayPlan?.plan.map((item: any, idx: number) => (
            <PlanItem key={idx} item={item} index={idx} isLast={idx === currentDayPlan.plan.length-1} navigation={navigation} destination={data.destination} />
          ))}
        </View>

        {/* HIDDEN GEMS REMOVED: Now at Place Details Screen natively */}

        {/* PREMIUM STAYS (ADDED BACK AT BOTTOM) */}
        {data?.stay_recommendations?.length > 0 && (
          <View style={styles.staySection}>
            <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 10 }]}>Premium Stays</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>
              {data.stay_recommendations.map((stay: any, idx: number) => (
                <View key={idx} style={styles.stayCard}>
                  <Image source={{ uri: `https://images.unsplash.com/photo-1566073771259-6a8506099945` }} style={styles.stayBanner} />
                  <View style={styles.stayDetails}>
                    <Text style={styles.stayName} numberOfLines={1}>{stay.name}</Text>
                    <Text style={styles.stayPrice}>{stay.price_per_night} / night</Text>
                    <Text style={styles.stayArea}>📍 {stay.area}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  shimmerLine: { height: 30, backgroundColor: '#eee', borderRadius: 8, marginBottom: 12 },
  shimmerChip: { width: 80, height: 32, borderRadius: 16, backgroundColor: '#eee' },
  
  heroContainer: { height: 320, width: W, backgroundColor: '#000' },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  absBack: { position: 'absolute', top: 50, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  absShare: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  heroContent: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  heroDest: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  statText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  stickyTabs: { backgroundColor: theme.background, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  dayTabs: { maxHeight: 50 },
  dayTabsContent: { 
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingRight: 40 
  },
  dayTab: { 
    paddingHorizontal: 24, 
    paddingVertical: 10, 
    borderRadius: RADIUS.full, 
    backgroundColor: theme.card, 
    marginRight: 12, 
    ...SHADOW.sm,
    minWidth: 80,
    alignItems: 'center'
  },
  dayTabActive: { backgroundColor: theme.teal, ...SHADOW.card },
  dayTabText: { fontSize: 14, fontWeight: '800', color: theme.textLight },
  dayTabTextActive: { color: '#fff' },

  roadmapSection: { paddingVertical: 15 },
  pathChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  pathText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase' },

  staySection: { marginBottom: 30 },
  stayCard: { width: 280, backgroundColor: theme.card, borderRadius: RADIUS.lg, marginRight: 15, overflow: 'hidden', ...SHADOW.sm },
  stayBanner: { width: '100%', height: 140 },
  stayDetails: { padding: 15 },
  stayName: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 5 },
  stayPrice: { fontSize: 14, fontWeight: '900', color: theme.success, marginBottom: 5 },
  stayArea: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  gemSection: { marginBottom: 30 },
  gemFlip: { width: 220, height: 280, marginRight: 15 },
  gemFace: { flex: 1, borderRadius: 20, overflow: 'hidden', ...SHADOW.md },
  gemImg: { width: '100%', height: '100%' },
  gemGradient: { ...StyleSheet.absoluteFillObject },
  gemOverlay: { position: 'absolute', bottom: 15, left: 15, right: 15 },
  gemName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  gemRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  gemRatingText: { color: '#FFD700', fontWeight: '800', fontSize: 12 },
  
  gemBack: { flex: 1, backgroundColor: theme.card, borderRadius: 20, padding: 15, justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  gemStoryTitle: { fontSize: 14, fontWeight: '900', color: theme.teal, marginBottom: 8, textTransform: 'uppercase' },
  gemStory: { fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 15 },
  gemMapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.teal, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start' },
  gemMapText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  pageContent: { padding: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: theme.text, marginBottom: 20 },
  
  insightCard: { flexDirection: 'row', gap: 15, padding: 16, backgroundColor: theme.card, borderRadius: RADIUS.lg, ...SHADOW.md, marginBottom: 25, borderLeftWidth: 4, borderLeftColor: theme.teal },
  insightIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  insightLabel: { fontSize: 10, fontWeight: '900', color: theme.teal, letterSpacing: 1 },
  insightText: { fontSize: 14, color: theme.text, fontWeight: '600', marginTop: 2, lineHeight: 20 },

  stepCard: { flexDirection: 'row' },
  stepTimeline: { width: 24, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.teal, marginTop: 8 },
  timelineLine: { flex: 1, width: 2, backgroundColor: theme.border, marginTop: 2, marginBottom: -2 },
  stepBody: { flex: 1, backgroundColor: theme.card, padding: 18, borderRadius: RADIUS.xl, marginLeft: 12, marginBottom: 25, ...SHADOW.sm },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.teal, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  timeBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
  stepCost: { fontSize: 15, fontWeight: '900', color: theme.success },
  stepActivity: { fontSize: 19, fontWeight: '900', color: theme.text, marginBottom: 8 },
  stepDesc: { fontSize: 14, color: theme.textSecondary, lineHeight: 22, marginBottom: 15 },
  stepContentRow: { flexDirection: 'row', gap: 15 },
  stepThumb: { width: 85, height: 85, borderRadius: RADIUS.md },
  stepFooter: { flexDirection: 'row', gap: 12, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: theme.borderLight },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.md },
  metaText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },

  // --- NEW FLIP STYLES ---
  stepFlip: { marginBottom: 25 },
  itineraryBack: { minHeight: 180, overflow: 'hidden' },
  backHeaderPremium: { paddingVertical: 12, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', height: 60 },
  backTitlePremium: { color: '#FFF', fontSize: 13, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  backSubTitlePremium: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  backBodyPremium: { padding: 15, flex: 1 },
  loadingContainerSmall: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  hookLineItinerary: { fontSize: 13, fontWeight: '700', fontStyle: 'italic', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  quickInfoGridSmall: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  infoPillSmall: { backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  infoPillTextSmall: { fontSize: 9, fontWeight: '700' },
  badgeRowSmall: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTextSmall: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  itineraryActionRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  miniBtn: { flex: 1, height: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  miniBtnText: { fontSize: 11, fontWeight: '900', color: '#fff' },

  heroHeader: { height: 320, width: W }
});
