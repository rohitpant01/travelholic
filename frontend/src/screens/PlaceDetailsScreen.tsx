import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Dimensions, ActivityIndicator, Alert, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import FlipCard from 'react-native-flip-card';
import { useAppTheme, COLORS, SHADOW, RADIUS } from '../utils/theme';
import { fetchPlaceImages, fetchPlaceImage } from '../api/imageService';
import { aiAPI, userAPI } from '../api/services';
import { RootState } from '../store';
import { addSaved, removeSaved } from '../store/slices/savedSlice';
import { updateUser } from '../store/slices/authSlice';
import { useSavedSync } from '../hooks/useSavedSync';
import { useToast } from '../context/ToastContext';
import ImageZoomViewer from '../components/ImageZoomViewer';

const { width: W } = Dimensions.get('window');

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

export default function PlaceDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const { showToast } = useToast();
  useSavedSync(); 
  
  const { place } = route.params || {};
  
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { ids: savedIds } = useSelector((state: RootState) => state.saved);
  
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [wikiDesc, setWikiDesc] = useState<string | null>(null);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [currentZoomImg, setCurrentZoomImg] = useState<string | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const saveTitle = place?.title || place?.name || place?.place || '';
  const isSaved = savedIds.includes(saveTitle);

  useEffect(() => {
    if (!place) return;

    const loadData = async () => {
      // 1. Fetch images for gallery
      const imgs = await fetchPlaceImages(saveTitle, 4);
      setImages(imgs);

      // 2. Fetch Deep AI Insights
      try {
        const placeLat = place.lat || place.coordinates?.lat || place.location?.lat;
        const placeLng = place.lng || place.coordinates?.lng || place.location?.lng;

        const res = await aiAPI.getPlaceInsights({
          placeName: saveTitle,
          lat: placeLat,
          lng: placeLng
        });
        setInsights(res.data);
      } catch (err) {
        console.log("Failed to load AI Insights", err);
      } finally {
        setLoadingInsights(false);
      }
    };
    loadData();

    // 3. Fallback description from Wikipedia if AI takes too long
    const fetchWiki = async () => {
      try {
        const title = saveTitle.split(',')[0].trim();
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        const data = await res.json();
        if (data.type === 'standard' && data.extract) {
          setWikiDesc(data.extract);
        }
      } catch(e) {}
    };
    if (!place.description && !place.story) fetchWiki();

  }, [place]);

  const handleToggleSave = async () => {
    if (!isAuthenticated) {
      Alert.alert("Login Required", "Sign in to save this place!", [
        { text: "Later" },
        { text: "Sign In", onPress: () => navigation.navigate('Login') }
      ]);
      return;
    }

    setSaving(true);
    try {
      if (isSaved) {
        dispatch(removeSaved(saveTitle));
        showToast('Removed', 'Destination removed from bucket list', 'info');
        const res = await userAPI.deleteSavedDestination(saveTitle);
        dispatch(updateUser({ savedDestinations: res.data.savedDestinations }));
      } else {
        const finalTitle = place.title || place.name || place.place || 'Exploring India';
        const finalImg = images[0] || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828';

        const bucketItem = {
          id: saveTitle,
          title: finalTitle,
          image: finalImg,
          location: place.location || place.name || place.place || 'Adventure Hub',
          description: place.story || place.description || wikiDesc || `Explore the hidden beauty of ${finalTitle}.`,
          bestTime: place.bestTime || 'Year round',
          tags: place.tags || [],
          whyLoveThis: insights?.why_to_visit || place.whyLoveThis || [],
          lat: place.lat,
          lng: place.lng,
          rating: place.rating || 4.8,
          budget: place.budget || 'Flexible'
        };
        dispatch(addSaved(bucketItem));
        showToast('Saved!', 'Added to your bucket list ✨', 'success');
        try {
          const res = await userAPI.saveDestination(bucketItem);
          dispatch(updateUser({ savedDestinations: res.data.savedDestinations }));
        } catch (err: any) {
          if (err.response?.status !== 400) dispatch(removeSaved(saveTitle));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenMap = () => {
    const lat = place.lat;
    const lng = place.lng;
    if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(saveTitle)}`);
    }
  };

  if (!place) return null;

  const prettifyLocation = (loc: string) => {
    if (!loc) return 'India';
    // Remove the place name itself from the location string if it's already there
    let clean = loc.replace(saveTitle, '').trim();
    if (clean.startsWith(',')) clean = clean.substring(1).trim();
    
    const parts = clean.split(',').map(p => p.trim()).filter(p => !p.includes('+') && p.length > 0);
    return parts.join(', ') || loc;
  };

  const finalDescription = place.story || place.description || wikiDesc || `Discover the soul of ${saveTitle}. A journey into nature and culture.`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PLACE DETAILS</Text>
        <TouchableOpacity onPress={handleToggleSave} style={styles.backBtn}>
           <Ionicons name={isSaved ? "heart" : "heart-outline"} size={24} color={isSaved ? "#FF5A5F" : theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Swipable Gallery */}
        <View style={{ height: 320 }}>
          {images.length > 0 ? (
            <ScrollView 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const newIdx = Math.round(e.nativeEvent.contentOffset.x / W);
                setActiveImgIdx(newIdx);
              }}
            >
              {images.map((img, i) => (
                <TouchableOpacity 
                  key={i} 
                  activeOpacity={0.9} 
                  onPress={() => { setCurrentZoomImg(img); setZoomVisible(true); }}
                  style={styles.heroContainer}
                >
                  <Image source={{ uri: img }} style={styles.heroImage} />
                  <LinearGradient colors={['transparent', theme.background]} style={styles.heroOverlay} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
             <View style={[styles.heroContainer, { backgroundColor: theme.card }]} />
          )}

          {/* Dots Indicator */}
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.dot, 
                    { backgroundColor: activeImgIdx === i ? '#fff' : 'rgba(255,255,255,0.4)', width: activeImgIdx === i ? 20 : 8 }
                  ]} 
                />
              ))}
            </View>
          )}
        </View>

        <ImageZoomViewer
          images={currentZoomImg ? [currentZoomImg] : (images.length > 0 ? images : [])}
          title={saveTitle}
          caption={finalDescription.substring(0, 80) + '...'}
          vibe={place.tags?.[0] || 'Hidden Gem'}
          visible={zoomVisible}
          onClose={() => setZoomVisible(false)}
        />

        <View style={styles.contentBody}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>{saveTitle}</Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={16} color={COLORS.teal} />
                <Text style={styles.locationText}>
                  {prettifyLocation(place.location || place.destination || 'India')}
                </Text>
              </View>
              <View style={styles.ratingInfoRow}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingInfoText}>
                  {place.rating || 4.8} <Text style={styles.reviewCount}>(120+ reviews)</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* STORY SECTION */}
          <View style={styles.storySection}>
             <Text style={styles.sectionLabel}>THE SECRET STORY</Text>
             <Text style={styles.descriptionText}>{finalDescription}</Text>
          </View>

          {/* BEST TIME BADGE */}
          <View style={styles.insightBox}>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
               <Ionicons name="calendar" size={16} color={COLORS.teal} />
               <Text style={styles.sectionLabel}>BEST TIME TO VISIT</Text>
             </View>
             <Text style={styles.insightValue}>{place.bestTime && place.bestTime !== 'Year round' ? place.bestTime : 'Oct – Mar'}</Text>
          </View>

          {loadingInsights ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
               <ActivityIndicator size="large" color={COLORS.teal} />
               <Text style={{ marginTop: 10, color: theme.textSecondary, fontWeight: '700' }}>Fetching AI Travel Guide...</Text>
            </View>
          ) : insights ? (
            <>
              {/* HOW TO REACH */}
              <View style={[styles.insightBox, { borderLeftWidth: 4, borderLeftColor: COLORS.teal }]}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                   <Ionicons name="navigate-circle" size={18} color={COLORS.teal} />
                   <Text style={styles.sectionLabel}>HOW TO REACH</Text>
                 </View>
                 <Text style={[styles.descriptionText, { marginTop: 10, fontSize: 14 }]}>{insights.how_to_reach}</Text>
              </View>

              {/* TRAVEL TIPS */}
              <View style={[styles.insightBox, { backgroundColor: theme.mode === 'dark' ? '#1c2e28' : '#e6f7f2', borderColor: 'transparent' }]}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                   <Ionicons name="bulb" size={18} color={COLORS.teal} />
                   <Text style={[styles.sectionLabel, { color: COLORS.teal }]}>EXPERT TRAVEL TIPS</Text>
                 </View>
                 <View style={{ marginTop: 15, gap: 12 }}>
                   {insights.travel_tips?.map((tip: string, i: number) => (
                     <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                       <Ionicons name="checkmark-circle" size={16} color={COLORS.teal} />
                       <Text style={{ fontSize: 14, color: theme.text, flex: 1, lineHeight: 20 }}>{tip}</Text>
                     </View>
                   ))}
                 </View>
              </View>

              {/* WHY TO VISIT */}
              <View style={styles.whySection}>
                <Text style={styles.sectionLabel}>✨ WHY YOU'LL LOVE THIS</Text>
                {insights.why_to_visit?.map((reason: string, i: number) => (
                  <View key={i} style={styles.reasonRow}>
                    <Ionicons name="sparkles" size={12} color={COLORS.teal} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>

              {/* NEARBY GEMS */}
              {insights.nearby_places?.length > 0 && (
                <View style={{ marginBottom: 40, marginTop: 20, marginHorizontal: -24 }}>
                  <Text style={[styles.titleText, { fontSize: 20, marginLeft: 24, marginBottom: 15 }]}>Nearby Hidden Treasures</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                    {insights.nearby_places.map((gem: any, idx: number) => (
                      <GemCard key={idx} gem={gem} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.mapSection}>
             <Text style={styles.sectionLabel}>📍 EXACT LOCATION</Text>
             <TouchableOpacity style={styles.mapPreviewBtn} onPress={handleOpenMap}>
                <Ionicons name="map" size={24} color={COLORS.teal} />
                <Text style={styles.mapPreviewText}>Open in Google Maps for Navigation</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
             </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>

      <View style={styles.detailsFooter}>
          <TouchableOpacity style={styles.footerActionBtn} onPress={handleOpenMap}>
             <Ionicons name="paper-plane" size={20} color="#FFF" />
             <Text style={styles.footerBtnText}>DIRECTIONS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.footerSaveBtn, { borderColor: isSaved ? "#FF5A5F" : COLORS.teal }]} 
            onPress={handleToggleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color={COLORS.teal} /> : (
              <>
                <Ionicons name={isSaved ? "heart" : "heart-outline"} size={20} color={isSaved ? "#FF5A5F" : COLORS.teal} />
                <Text style={[styles.footerSaveText, { color: isSaved ? "#FF5A5F" : COLORS.teal }]}>
                   {isSaved ? "SAVED" : "SAVE BUCKET"}
                </Text>
              </>
            )}
          </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: theme.background,
  },
  backBtn: { 
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, 
    alignItems: 'center', justifyContent: 'center', ...SHADOW.sm 
  },
  headerTitle: { fontSize: 13, fontWeight: '800', color: theme.textLight, letterSpacing: 1.5 },
  scrollContent: { paddingBottom: 100 },
  heroContainer: { width: W, height: 320 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  dotsRow: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
  
  contentBody: { paddingHorizontal: 24, marginTop: -20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  titleText: { fontSize: 32, fontWeight: '900', color: theme.text, letterSpacing: -1 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationText: { fontSize: 15, fontWeight: '700', color: COLORS.teal },
  ratingInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ratingInfoText: { fontSize: 14, fontWeight: '800', color: theme.text },
  reviewCount: { color: theme.textLight, fontWeight: '600' },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: COLORS.teal, letterSpacing: 1.5, marginBottom: 8 },
  storySection: { marginBottom: 30 },
  descriptionText: { fontSize: 16, lineHeight: 26, color: theme.textSecondary, textAlign: 'justify' },
  
  whySection: { marginBottom: 30 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  reasonText: { fontSize: 15, fontWeight: '500', color: theme.textSecondary },
  
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 30 },
  
  insightBox: { backgroundColor: theme.card, padding: 20, borderRadius: RADIUS.xl, marginBottom: 30, ...SHADOW.sm, borderWidth: 1, borderColor: theme.border },
  insightValue: { fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 4 },
  
  mapSection: { marginBottom: 40 },
  mapPreviewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 20, borderRadius: 20, gap: 15, ...SHADOW.sm },
  mapPreviewText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.text },

  detailsFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', gap: 12
  },
  footerActionBtn: { flex: 1.5, height: 56, backgroundColor: COLORS.teal, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...SHADOW.md },
  footerBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  footerSaveBtn: { flex: 1.2, height: 56, borderRadius: 16, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerSaveText: { fontSize: 14, fontWeight: '800' },

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
});
