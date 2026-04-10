import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, TextInput, Linking,
  FlatList, Animated, Share, Platform
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { lyraAPI } from '../api/services';

import WebDownloadBanner from '../components/WebDownloadBanner';

const { width: W, height: H } = Dimensions.get('window');

const DAY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4'];

const isWeb = Platform.OS === 'web';

// ─── SHIMMER LOADER ──────────────────────────────────────────
const ShimmerLoader = () => {
  const theme = useAppTheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 20 }}>
        <Animated.View style={{ width: '60%', height: 24, backgroundColor: theme.border, borderRadius: 8, opacity, marginBottom: 12 }} />
        <Animated.View style={{ width: '40%', height: 16, backgroundColor: theme.border, borderRadius: 8, opacity, marginBottom: 30 }} />
        <Animated.View style={{ width: '100%', height: H * 0.3, backgroundColor: theme.border, borderRadius: 16, opacity, marginBottom: 20 }} />
        {[1, 2, 3].map(i => (
          <Animated.View key={i} style={{ width: '100%', height: 100, backgroundColor: theme.border, borderRadius: 16, opacity, marginBottom: 16 }} />
        ))}
      </View>
    </SafeAreaView>
  );
};

// ─── CONFIDENCE BAR ──────────────────────────────────────────
const ConfidenceBar = ({ confidence }: { confidence: number }) => {
  const theme = useAppTheme();
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? '#27AE60' : pct >= 50 ? '#F0A500' : '#E74C3C';
  const label = pct >= 80 ? 'High confidence' : pct >= 50 ? 'Review suggested' : '⚠️ You may want to edit this plan';

  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.5 }}>LYRA CONFIDENCE</Text>
        <Text style={{ fontSize: 13, fontWeight: '900', color }}>{pct}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: theme.borderLight, borderRadius: 3 }}>
        <View style={{ height: 6, width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
      <Text style={{ fontSize: 11, color: theme.textLight, marginTop: 4, fontWeight: '600' }}>{label}</Text>
    </View>
  );
};

// ─── COST BREAKDOWN ──────────────────────────────────────────
const CostBreakdown = ({ costs }: { costs: any }) => {
  const theme = useAppTheme();
  if (!costs) return null;

  const items = [
    { label: 'Stay', value: costs.stay, color: '#3B82F6', icon: 'bed-outline' },
    { label: 'Food', value: costs.food, color: '#10B981', icon: 'restaurant-outline' },
    { label: 'Activities', value: costs.activities, color: '#F59E0B', icon: 'ticket-outline' },
  ].filter(i => i.value);

  // Try extracting numeric for bar widths
  const extractNum = (s: string) => {
    const m = s.match(/[\d,]+/g);
    return m ? parseInt(m[m.length - 1].replace(/,/g, '')) : 0;
  };
  const maxVal = Math.max(...items.map(i => extractNum(i.value)), 1);

  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 16 }}>💰 Cost Breakdown</Text>
      {items.map((item, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={item.icon as any} size={14} color={item.color} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{item.label}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '900', color: item.color }}>{item.value}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: theme.borderLight, borderRadius: 4 }}>
            <View style={{
              height: 8,
              width: `${Math.max(20, (extractNum(item.value) / maxVal) * 100)}%`,
              backgroundColor: item.color,
              borderRadius: 4,
            }} />
          </View>
        </View>
      ))}
      {costs.total_estimate && (
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
          paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.borderLight
        }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: theme.text }}>Total Estimate</Text>
          <Text style={{ fontSize: 15, fontWeight: '900', color: theme.teal }}>{costs.total_estimate}</Text>
        </View>
      )}
    </View>
  );
};

// ─── STAY CARD ───────────────────────────────────────────────
const StayCard = ({ stay, theme }: { stay: any; theme: any }) => {
  const typeIcons: any = { Budget: 'wallet-outline', 'Mid-range': 'home-outline', Luxury: 'diamond-outline' };
  const typeColors: any = { Budget: '#10B981', 'Mid-range': '#3B82F6', Luxury: '#F59E0B' };
  const color = typeColors[stay.type] || theme.teal;

  return (
    <View style={{
      width: 220, backgroundColor: theme.card, borderRadius: 16,
      marginRight: 14, padding: 16, ...SHADOW.sm,
      borderLeftWidth: 4, borderLeftColor: color,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={typeIcons[stay.type] || 'bed-outline'} size={16} color={color} />
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>{stay.type}</Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '600' }}>{stay.stay_type}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '900', color: color, marginBottom: 4 }}>{stay.price_range}</Text>
      <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginBottom: 12 }}>📍 {stay.area}</Text>
      {stay.deals_url ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(stay.deals_url)}
          style={{ backgroundColor: color, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>View Deals →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ─── PLACE CARD (EDITABLE) ───────────────────────────────────
const PlaceCard = ({ place, dayColor, isLast, onRemove, onUpdate }: any) => {
  const theme = useAppTheme();
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(place.notes || '');

  const handleSaveEdit = () => {
    onUpdate({ ...place, notes: editNotes });
    setEditing(false);
  };

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 20 }}>
      {/* Timeline */}
      <View style={{ width: 24, alignItems: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dayColor, marginTop: 8 }} />
        {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: dayColor + '30', marginTop: 2 }} />}
      </View>
      
      {/* Card */}
      <View style={{
        flex: 1, backgroundColor: theme.card, padding: 16, borderRadius: 16,
        marginLeft: 12, marginBottom: 16, ...SHADOW.sm,
      }}>
        {/* Places */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {place.places?.map((p: any, i: number) => {
            const placeName = typeof p === 'object' && p !== null ? p.name || p.place || p.title || 'Unknown Place' : p;
            return (
              <View key={i} style={{ backgroundColor: dayColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: dayColor }}>📍 {placeName}</Text>
              </View>
            );
          })}
        </View>

        {/* Activities */}
        {place.activities?.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {place.activities.map((a: any, i: number) => {
              const actName = typeof a === 'object' && a !== null ? a.name || a.activity || a.title || 'Activity' : a;
              return (
                <View key={i} style={{ backgroundColor: theme.borderLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>🏃 {actName}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Notes (editable) */}
        {editing ? (
          <View>
            <TextInput
              value={editNotes}
              onChangeText={setEditNotes}
              style={{
                fontSize: 13, color: theme.text, backgroundColor: theme.borderLight,
                borderRadius: 10, padding: 10, minHeight: 60, textAlignVertical: 'top',
                marginBottom: 8,
              }}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={handleSaveEdit} style={{ backgroundColor: theme.teal, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(false)} style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
                <Text style={{ color: theme.textLight, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20, fontWeight: '500' }}>{place.notes}</Text>
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
          <TouchableOpacity onPress={() => setEditing(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="pencil-outline" size={14} color={theme.teal} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.teal }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="trash-outline" size={14} color={theme.error} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>Remove</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => {
              // 🛤️ Build a multi-stop route if multiple places exist
              const coords: any[] = [];
              if (place.latitude && place.longitude) coords.push({ lat: place.latitude, lng: place.longitude });
              place.places?.forEach((p: any) => {
                if (typeof p === 'object' && p !== null && p.latitude && p.longitude) {
                  coords.push({ lat: p.latitude, lng: p.longitude });
                }
              });

              if (coords.length > 1) {
                // Direction Route: Origin=1st, Destination=Last, Waypoints=Middle
                const origin = `${coords[0].lat},${coords[0].lng}`;
                const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lng}`;
                const waypoints = coords.slice(1, -1).map(c => `${c.lat},${c.lng}`).join('|');
                const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
                Linking.openURL(url);
              } else if (coords.length === 1) {
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords[0].lat},${coords[0].lng}`);
              } else {
                Alert.alert('No coordinates', 'Could not find a precise location for this day.');
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="navigate-outline" size={14} color={theme.textSecondary} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>Maps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function LyraItineraryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const theme = useAppTheme();
  const mapRef = useRef<MapView>(null);

  // 🛰️ Destructure params with fallbacks for both fresh and saved trips
  const { 
    caption, 
    location: paramLocation, 
    postId, 
    itinerary: preloaded,
    data: passedData,
    savedId: passedSavedId
  } = route.params || {};

  // Clean location string (preventing "undefined")
  const cleanLocation = (paramLocation && paramLocation !== 'undefined') ? paramLocation : 'Discovering...';

  const initialData = passedData || preloaded || null;
  const [loading, setLoading] = useState(!initialData);
  const [data, setData] = useState<any>(initialData);
  const [activeDay, setActiveDay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(passedSavedId || null);
  const [sharing, setSharing] = useState(false);

  // ── Initial Hydration (Generation or Load by ID) ──
  useEffect(() => {
    const { id: deepLinkId } = route.params || {};
    
    if (deepLinkId) {
      // 🔗 Case: Opened via Deep Link (trip/:id)
      loadSavedItinerary(deepLinkId);
    } else if (!initialData && !caption) {
      // ⚠️ Fallback if someone hits /trip/ with no ID
      console.log('[Lyra] Missing id and caption, redirecting to Discover');
      navigation.navigate('MainTabs', { screen: 'Travelers' });
    } else if (!initialData) {
      // 🛰️ Case: Fresh AI Generation from Post/Caption
      generateItinerary();
    }
  }, [initialData]);

  const loadSavedItinerary = async (id: string) => {
    setLoading(true);
    try {
      const res = await lyraAPI.getLyraById(id);
      setData(res.data);
      setSavedId(id);
    } catch (e: any) {
      Alert.alert('Link Error', 'This itinerary could not be found or has been removed.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const generateItinerary = async () => {
    setLoading(true);
    try {
      const res = await lyraAPI.generate({ caption, location: cleanLocation, tags: [] });
      const generatedData = res.data;
      setData(generatedData);
    } catch (e: any) {
      if (e.response?.status === 429) {
        const nextTime = e.response.data.nextAvailableAt;
        const formattedTime = nextTime ? new Date(nextTime).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }) : 'later';
        
        Alert.alert(
          'Limit Reached ⏳',
          `Lyra needs a break! You've used your 2 free generations for now. Please try again after ${formattedTime}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Lyra Error', e.response?.data?.error || 'Could not generate itinerary. Try again!');
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Map helpers ──
  const getDayPins = useCallback(() => {
    if (!data?.itinerary) return [];
    const pins: any[] = [];
    data.itinerary.forEach((day: any, dayIdx: number) => {
      const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
      // Each day may have lat/lng at top level or per-place
      if (day.latitude && day.longitude) {
        pins.push({ lat: day.latitude, lng: day.longitude, title: `Day ${day.day}`, color, dayIdx });
      }
      // Or places array might have coords
      day.places?.forEach((p: any, pIdx: number) => {
        const placeName = typeof p === 'object' && p !== null ? p.name || p.place || p.title : p;
        const pLat = typeof p === 'object' && p !== null && p.latitude ? p.latitude : day.latitude;
        const pLng = typeof p === 'object' && p !== null && p.longitude ? p.longitude : day.longitude;
        
        if (pLat && pLng) {
          // Offset slightly for multiple places on same day if using day coords
          const isDayCoord = pLat === day.latitude && pLng === day.longitude;
          const offset = isDayCoord ? pIdx * 0.002 : 0;
          pins.push({
            lat: pLat + offset, 
            lng: pLng + offset,
            title: placeName, color, dayIdx,
          });
        }
      });
    });
    return pins;
  }, [data]);

  const pins = getDayPins();

  const fitAllPoints = useCallback(() => {
    if (pins.length > 0 && mapRef.current) {
      const coords = pins.map(p => ({ latitude: p.lat, longitude: p.lng }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [pins]);

  // 🔥 Auto-zoom to show full route on load
  useEffect(() => {
    if (data && pins && pins.length > 0) {
      setTimeout(fitAllPoints, 1000);
    }
  }, [data?._id, pins?.length, fitAllPoints]); // Re-run if model ID or number of pins changes

  const focusDay = useCallback((dayIdx: number) => {
    setActiveDay(dayIdx);
    if (!data?.itinerary?.[dayIdx]) return;
    const day = data.itinerary[dayIdx];
    if (day.latitude && day.longitude) {
        mapRef.current?.animateToRegion({
        latitude: day.latitude,
        longitude: day.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  }, [data]);



  // ── Actions ──
  const performSave = async (payloadOverride?: any) => {
    const dataToSave = payloadOverride || data;
    if (saving || (savedId && !payloadOverride) || !dataToSave) return;
    
    setSaving(true);
    try {
      const res = await lyraAPI.save({
        sourcePostId: postId,
        travel_type: dataToSave.travel_type,
        itinerary: dataToSave.itinerary,
        stay_suggestions: dataToSave.stay_suggestions,
        estimated_cost: dataToSave.estimated_cost,
        nearby_recommendations: dataToSave.nearby_recommendations,
        confidence: dataToSave.confidence,
        locationName: cleanLocation || 'Trip',
        coordinates: (dataToSave.itinerary && dataToSave.itinerary[0]) ? { 
          lat: dataToSave.itinerary[0].latitude, 
          lng: dataToSave.itinerary[0].longitude 
        } : undefined,
        visibility: 'public',
      });

      // Update state with the returned full document
      const savedDoc = res.data;
      setData(savedDoc);
      setSavedId(savedDoc._id || savedDoc.id);

      if (!payloadOverride) Alert.alert('Saved! 🎒', 'Itinerary added to your trips.');
    } catch (e: any) {
      if (!payloadOverride) Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => performSave();

  // ── Share logic ──
  const handleShare = async () => {
    let finalId = savedId;
    
    // 1. Ensure the trip is saved to get a Unique ID for the link
    if (!finalId) {
      setSharing(true);
      try {
        const res = await lyraAPI.save({
          ...data,
          locationName: data?.location?.name || cleanLocation,
          visibility: 'public'
        });
        finalId = res.data._id;
        setSavedId(finalId);
      } catch (e) {
        Alert.alert('Share Error', 'We need to save this to the cloud before sharing. Please try again!');
        return;
      } finally {
        setSharing(false);
      }
    }

    // 2. Generate the Dynamic Link
    const shareUrl = `https://ekalgo.com/trip/${finalId}`;
    
    try {
      await Share.share({
        title: `EkalGo: ${data?.location?.name || 'AI Itinerary'}`,
        message: `Check out my travel plan for ${data?.location?.name || 'this trip'} on EkalGo! 🌍✨\n\nView Itinerary: ${shareUrl}`,
        url: shareUrl, // iOS only
      });
    } catch (e) {}
  };

  const handleClone = async () => {
    if (!savedId) {
      Alert.alert('Save First', 'Please save the itinerary before cloning.');
      return;
    }
    try {
      await lyraAPI.clone(savedId);
      Alert.alert('Cloned! 📋', 'Itinerary copied to your backpack.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to clone');
    }
  };

  // ── Edit helpers ──
  const handleRemovePlace = (dayIdx: number) => {
    const updated = { ...data };
    updated.itinerary = updated.itinerary.filter((_: any, i: number) => i !== dayIdx);
    setData(updated);
    if (activeDay >= updated.itinerary.length) setActiveDay(Math.max(0, updated.itinerary.length - 1));
  };

  const handleUpdatePlace = (dayIdx: number, newPlace: any) => {
    const updated = { ...data };
    updated.itinerary = [...updated.itinerary];
    updated.itinerary[dayIdx] = newPlace;
    setData(updated);
  };

  if (loading) return <ShimmerLoader />;
  if (!data) return null;

  const currentDay = data.itinerary?.[activeDay];
  const dayColor = DAY_COLORS[activeDay % DAY_COLORS.length];

  // Find initial map region from first pin or default India
  const initialRegion = pins.length > 0
    ? { latitude: pins[0].lat, longitude: pins[0].lng, latitudeDelta: 0.1, longitudeDelta: 0.1 }
    : { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 5, longitudeDelta: 5 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Lyra Itinerary</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>{data.travel_type || 'Trip'} • {data.itinerary?.length || 0} days</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 220 }}>
        
        {/* ✨ Web Nudge Banner */}
        <WebDownloadBanner tripId={savedId} />

        {/* ── MAP / WEB HERO ── */}
        <View style={{ height: H * 0.3, margin: 16, borderRadius: 20, overflow: 'hidden', ...SHADOW.md, backgroundColor: theme.card }}>
          {isWeb ? (
            <LinearGradient 
              colors={[theme.tealLight, theme.background]} 
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}
            >
              <Ionicons name="map-outline" size={48} color={theme.teal} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 10 }}>Route Overview</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginTop: 4 }}>
                {pins.length} stops found in this {data.travel_type || 'trip'}. Open the app for interactive GPS navigation.
              </Text>
            </LinearGradient>
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={initialRegion}
              provider={PROVIDER_GOOGLE}
              showsUserLocation
              onMapReady={fitAllPoints}
            >
              {/* 🛤️ Sequential Route Line */}
              <Polyline
                coordinates={pins.map(p => ({ latitude: Number(p.lat), longitude: Number(p.lng) }))}
                strokeColor={theme.teal}
                strokeWidth={3}
                lineDashPattern={[0]}
              />

              {pins.map((pin, i) => (
                <Marker
                  key={i}
                  coordinate={{ latitude: Number(pin.lat), longitude: Number(pin.lng) }}
                  title={pin.title}
                  pinColor={pin.color}
                  onPress={() => focusDay(pin.dayIdx)}
                >
                  {/* 📍 Custom Pin with Day Number */}
                  <View style={{
                    backgroundColor: pin.color, paddingHorizontal: 6, paddingVertical: 2,
                    borderRadius: 10, borderWidth: 2, borderColor: '#fff'
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>D{pin.dayIdx + 1}</Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          )}

          {/* Map Controls (Only for Mobile) */}
          {!isWeb && (
            <TouchableOpacity 
              onPress={fitAllPoints}
              style={[styles.mapControlBtn, { backgroundColor: theme.teal }]}
            >
              <Ionicons name="map" size={16} color="#fff" />
              <Text style={styles.mapControlText}>View Route</Text>
            </TouchableOpacity>
          )}

          {/* Map Legend */}
          {!isWeb && (
            <View style={[styles.mapLegend, { backgroundColor: theme.card + 'E6' }]}>
              {data.itinerary?.slice(0, 5).map((_: any, i: number) => (
                <TouchableOpacity key={i} onPress={() => focusDay(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DAY_COLORS[i % DAY_COLORS.length] }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text }}>D{i + 1}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── DAY TABS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, marginBottom: 12 }}>
          {data.itinerary?.map((_: any, idx: number) => {
            const isActive = activeDay === idx;
            const color = DAY_COLORS[idx % DAY_COLORS.length];
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => focusDay(idx)}
                style={[
                  styles.dayTab,
                  { backgroundColor: isActive ? color : theme.card, ...SHADOW.sm },
                ]}
              >
                <Text style={[styles.dayTabText, { color: isActive ? '#fff' : theme.textLight }]}>
                  Day {idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── CONFIDENCE ── */}
        {data.confidence != null && <ConfidenceBar confidence={data.confidence} />}

        {/* ── TIMELINE CARDS ── */}
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>📅 Day {(currentDay?.day || activeDay + 1)} Plan</Text>
          {currentDay ? (
            <PlaceCard
              place={currentDay}
              dayColor={dayColor}
              isLast={true}
              onRemove={() => handleRemovePlace(activeDay)}
              onUpdate={(p: any) => handleUpdatePlace(activeDay, p)}
            />
          ) : (
            <View style={{ paddingHorizontal: 20, paddingVertical: 30, alignItems: 'center' }}>
              <Text style={{ color: theme.textLight, fontSize: 14 }}>No plan for this day</Text>
            </View>
          )}
        </View>

        {/* ── STAY SUGGESTIONS ── */}
        {data.stay_suggestions?.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🏨 Stay Suggestions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
              {data.stay_suggestions.map((stay: any, idx: number) => (
                <StayCard key={idx} stay={stay} theme={theme} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── COST BREAKDOWN ── */}
        {data.estimated_cost && <CostBreakdown costs={data.estimated_cost} />}

        {/* ── NEARBY RECOMMENDATIONS ── */}
        {data.nearby_recommendations?.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🌟 Nearby Gems</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.nearby_recommendations.map((rec: any, idx: number) => {
                const recName = typeof rec === 'object' && rec !== null ? rec.name || rec.title || 'Explore' : rec;
                return (
                  <View key={idx} style={{
                    backgroundColor: theme.card, paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: 12, ...SHADOW.sm
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{recName}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── STICKY ACTION BUTTONS ── */}
      <View style={[styles.actionBar, { backgroundColor: theme.card, borderTopColor: theme.borderLight }]}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !!savedId}
          style={[
            styles.primaryBtn,
            { backgroundColor: savedId ? theme.success : theme.teal, opacity: saving ? 0.6 : 1 }
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name={savedId ? 'checkmark-circle' : 'bookmark'} size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{savedId ? 'Saved ✓' : 'Save Itinerary'}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={handleShare}
            disabled={sharing || !savedId}
            style={[styles.secondaryBtn, { borderColor: theme.teal, opacity: savedId ? 1 : 0.4 }]}
          >
            <Ionicons name="share-social" size={16} color={theme.teal} />
            <Text style={[styles.secondaryBtnText, { color: theme.teal }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClone}
            disabled={!savedId}
            style={[styles.secondaryBtn, { borderColor: theme.textSecondary, opacity: savedId ? 1 : 0.4 }]}
          >
            <Ionicons name="copy" size={16} color={theme.textSecondary} />
            <Text style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>Clone</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  mapLegend: {
    position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', gap: 12,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    flexDirection: 'row', gap: 10,
    zIndex: 10,
  },
  mapControlBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    ...SHADOW.md,
  },
  mapControlText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dayTab: {
    paddingHorizontal: 22, paddingVertical: 10, borderRadius: RADIUS.full, minWidth: 80, alignItems: 'center',
  },
  dayTabText: { fontSize: 13, fontWeight: '800' },

  sectionTitle: { fontSize: 18, fontWeight: '900', paddingHorizontal: 20, marginBottom: 14 },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 28,
    borderTopWidth: 1, gap: 10,
  },
  primaryBtn: {
    height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '800' },
});
