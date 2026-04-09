import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { tripAPI, lyraAPI, aiAPI } from '../api/services';
import Slider from '@react-native-community/slider';
import { setTrips, appendTrips, setMyTrips, setLoading, setActiveTab, removeTripFromList } from '../store/slices/tripSlice';
import { RootState } from '../store';
import ScreenWrapper from '../components/ScreenWrapper';

const getBudgetLabel = (val: number) => {
  if (val < 5000) return `₹${val.toLocaleString('en-IN')} (Extreme Budget) 🎒`;
  if (val < 20000) return `₹${val.toLocaleString('en-IN')} (Economy) 💸`;
  if (val < 60000) return `₹${val.toLocaleString('en-IN')} (Mid-range) 🏨`;
  return `₹${val.toLocaleString('en-IN')} (Premium/Luxury) 💎`;
};

const MODE_ICONS: Record<string, string> = {
  flight: '✈️', train: '🚂', car: '🚗', bus: '🚌', bike: '🏍️', other: '🌍',
};

const BUDGET_COLORS: Record<string, string> = {
  'Budget': '#27AE60', 'Mid-range': '#F0A500', 'Luxury': '#E74C3C',
};

const FILTER_OPTIONS = {
  budget: ['Budget', 'Mid-range', 'Luxury'],
  travelType: ['Solo', 'Group', 'Couples'],
  mode: ['flight', 'train', 'car', 'bus', 'bike'],
  tags: [
    'Adventure', 'Food', 'Spiritual', 'Cultural', 'Nightlife',
    'Photography', 'Trekking', 'Beach', 'Road Trip', 'Backpacking',
  ],
};

export default function TripsScreen() {
  const theme = useAppTheme();
  const dispatch = useDispatch();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  const { trips, myTrips, loading, activeTab } = useSelector((s: RootState) => s.trip);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<any>({});

  // AI Planner Form State
  const [aiForm, setAiForm] = useState({
    sourceCity: '',
    destination: '',
    days: 'Weekend Escape (2 Days)',
    actualDays: 2,
    budget: 25000,
    travelType: 'Solo',
    interests: [] as string[],
  });

  const [sourceSuggestions, setSourceSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  // 🧪 PERSISTENT DEBOUNCE
  const debounceRef = useRef<any>(null);

  const fetchSuggestions = async (q: string, setSugg: Function) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 3) {
      setSugg([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setFetchingSuggestions(true);
        const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${q}&types=(cities)&key=${key}`
        );
        const data = await res.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.warn(`[Google Places Error] Status: ${data.status}`);
        }

        if (data.predictions) {
          setSugg(data.predictions);
        }
      } catch (e) {
        console.error('Autocomplete error:', e);
      } finally {
        setFetchingSuggestions(false);
      }
    }, 500);
  };

  const BUDGET_OPTIONS = ['5000', '10000', '20000', '50000', '100000'];

  const fetchTrips = useCallback(async (reset = false) => {
    try {
      dispatch(setLoading(true));
      const p = reset ? 1 : page;
      const res = await tripAPI.getTrips({ ...filters, page: p });
      if (reset) {
        dispatch(setTrips(res.data.trips));
        setPage(2);
      } else {
        dispatch(appendTrips(res.data.trips));
        setPage(p + 1);
      }
      setHasMore(res.data.page < res.data.totalPages);
    } catch (e) {
      console.error('[TripsScreen] fetch error:', e);
    } finally {
      dispatch(setLoading(false));
      setRefreshing(false);
    }
  }, [filters, page, dispatch]);

  const handleDeleteTrip = async (id: string, type: 'social' | 'lyra') => {
    Alert.alert(
      'Delete Trip?',
      'This will permanently remove this itinerary from your collection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (type === 'lyra') {
                await lyraAPI.delete(id);
              } else if (type === 'ai_itinerary') {
                await aiAPI.deleteItinerary(id);
              } else {
                await tripAPI.deleteTrip(id);
              }
              dispatch(removeTripFromList(id));
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to delete');
            }
          }
        }
      ]
    );
  };

  const fetchMyTrips = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const res = await tripAPI.getMyTrips();
      dispatch(setMyTrips(res.data.trips));
    } catch (e) {
      console.error('[TripsScreen] my trips error:', e);
    } finally {
      dispatch(setLoading(false));
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'explore') fetchTrips(true);
    else fetchMyTrips();
  }, [activeTab, filters]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'explore') fetchTrips(true);
    else fetchMyTrips();
  };

  const data = activeTab === 'explore' ? trips : myTrips;

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const renderAIPlanner = () => {
    const DURATION_OPTIONS = [
      { id: '1', label: '1 Day Trip', days: 1 },
      { id: 'weekend', label: 'Weekend Escape (2 Days)', days: 2 },
      { id: 'mini', label: 'Mini Adventure (4 Days)', days: 4 },
      { id: 'explorer', label: 'Explorer Mode (7 Days)', days: 7 },
    ];

    const getBudgetLabel = (val: number) => {
      const formatted = new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0,
      }).format(val);

      if (val < 15000) return `₹${formatted} 💸`;
      if (val < 40000) return `₹${formatted} ⚖️`;
      return `₹${formatted} 💎`;
    };

    const TRENDING = [
      { name: 'Goa', emoji: '🏝️', color: '#00C9A7' },
      { name: 'Manali', emoji: '❄️', color: '#008E7F' },
      { name: 'Bali', emoji: '🌴', color: '#FF7E5F' },
    ];

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.glassCard}>
          <Text style={styles.glassTitle}>✨ Build Your Perfect Trip</Text>
          <Text style={styles.glassSubtitle}>AI-crafted trips, just for you</Text>

          <View style={styles.glassForm}>
            {/* Source */}
            <View style={[styles.inputSection, { zIndex: sourceSuggestions.length > 0 ? 1001 : 100 }]}>
              <Text style={styles.glassLabel}>📍 Where are you starting from?</Text>
              <TextInput
                style={styles.glassInput}
                placeholder="Enter your departure city"
                placeholderTextColor={theme.textSecondary}
                value={aiForm.sourceCity}
                onChangeText={(t) => {
                  setAiForm(f => ({ ...f, sourceCity: t }));
                  fetchSuggestions(t, setSourceSuggestions);
                }}
              />
              {sourceSuggestions.length > 0 && (
                <View style={styles.glassSuggestions}>
                  {sourceSuggestions.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.glassSuggestionItem}
                      onPress={() => {
                        setAiForm(f => ({ ...f, sourceCity: s.description }));
                        setSourceSuggestions([]);
                        Keyboard.dismiss();
                      }}
                    >
                      <Ionicons name="location" size={14} color={theme.teal} />
                      <Text style={styles.glassSuggestionText} numberOfLines={1}>{s.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Destination */}
            <View style={[styles.inputSection, { zIndex: destSuggestions.length > 0 ? 1001 : 90 }]}>
              <Text style={styles.glassLabel}>🌍 Where do you want to go?</Text>
              <TextInput
                style={styles.glassInput}
                placeholder="Search destinations (Goa, Bali)"
                placeholderTextColor={theme.textSecondary}
                value={aiForm.destination}
                onChangeText={(t) => {
                  setAiForm(f => ({ ...f, destination: t }));
                  fetchSuggestions(t, setDestSuggestions);
                }}
              />
              <View style={styles.chipRow}>
                {['Goa', 'Manali', 'Dubai'].map(city => (
                  <TouchableOpacity key={city} style={styles.pillChip} onPress={() => setAiForm(f => ({ ...f, destination: city }))}>
                    <Text style={styles.pillChipText}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {destSuggestions.length > 0 && (
                <View style={styles.glassSuggestions}>
                  {destSuggestions.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.glassSuggestionItem}
                      onPress={() => {
                        setAiForm(f => ({ ...f, destination: s.description }));
                        setDestSuggestions([]);
                        Keyboard.dismiss();
                      }}
                    >
                      <Ionicons name="location" size={14} color={theme.teal} />
                      <Text style={styles.glassSuggestionText} numberOfLines={1}>{s.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Duration Dropdown */}
            <View style={styles.inputSection}>
              <Text style={styles.glassLabel}>⏳ How long is your trip?</Text>
              <TouchableOpacity
                style={styles.glassSelect}
                onPress={() => setShowDurationPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.glassSelectText}>{aiForm.days}</Text>
                <Ionicons name="chevron-down" size={20} color={theme.teal} />
              </TouchableOpacity>
            </View>

            {/* Budget */}
            <View style={styles.inputSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <View>
                  <Text style={styles.glassLabel}>💰 Budget Range</Text>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: -8 }}>Manual entry or slide</Text>
                </View>
                <View style={styles.manualBudgetInputWrapper}>
                  <Text style={{ color: theme.teal, fontWeight: '900', fontSize: 18, marginRight: 4 }}>₹</Text>
                  <TextInput
                    style={styles.manualBudgetInput}
                    keyboardType="numeric"
                    value={aiForm.budget.toString()}
                    onChangeText={(val) => {
                      const num = parseInt(val.replace(/[^0-9]/g, '')) || 0;
                      setAiForm(f => ({ ...f, budget: num > 1000000 ? 1000000 : num }));
                    }}
                    maxLength={7}
                  />
                </View>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={500}
                maximumValue={150000}
                step={500}
                value={aiForm.budget}
                onValueChange={(v) => setAiForm(f => ({ ...f, budget: v }))}
                minimumTrackTintColor={theme.teal}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.teal}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.rangeLimit}>₹1k</Text>
                <Text style={styles.rangeLimit}>₹1.5L+</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.premiumCTA}
              activeOpacity={0.8}
              onPress={() => {
                if (!aiForm.destination) {
                  Alert.alert('EkalGo AI', 'Tell us where you want to go! ✨');
                  return;
                }
                nav.navigate('AIItinerary', {
                  trip: {
                    source: { city: aiForm.sourceCity || 'Nearby' },
                    destination: { city: aiForm.destination },
                    duration: aiForm.actualDays,
                    budget: `₹${aiForm.budget.toLocaleString('en-IN')}`,
                    travelType: aiForm.travelType,
                    interests: aiForm.interests,
                  }
                });
              }}
            >
              <LinearGradient colors={['#00C9A7', '#008E7F']} style={styles.premiumCTAGrad}>
                <Text style={styles.premiumCTAText}>✨ Create My Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>🔥 Trending Right Now</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
          {TRENDING.map((t, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.trendingCard, { backgroundColor: t.color + '15', borderColor: t.color + '40' }]}
              onPress={() => setAiForm(f => ({ ...f, destination: t.name }))}
            >
              <Text style={styles.trendingEmoji}>{t.emoji}</Text>
              <Text style={styles.trendingName}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>
    );
  };

  const renderTripCard = ({ item }: { item: any }) => {
    const isLyra = item.tripType === 'lyra';
    const isAI = item.tripType === 'ai_itinerary';
    
    return (
      <TouchableOpacity
        style={[styles.card, (isLyra || isAI) && { borderColor: theme.teal, borderWidth: 1 }]}
        activeOpacity={0.85}
        onPress={() => {
          if (isLyra) nav.navigate('LyraItinerary', { data: item, savedId: item._id });
          else if (isAI) nav.navigate('AIItinerary', { savedData: item });
          else nav.navigate('TripDetail', { tripId: item._id });
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.modeIcon}>{isLyra || isAI ? '✨' : (MODE_ICONS[item.mode] || '🌍')}</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.routeText} numberOfLines={1}>
              {item.displayDestination || (item.destination?.city ? (item.source?.city ? `${item.source.city} → ${item.destination.city}` : item.destination.city) : (typeof item.destination === 'string' ? item.destination : 'Untitled Trip'))}
            </Text>
            <Text style={styles.dateText}>
              {isLyra || isAI ? 'AI Itinerary' : `${MODE_ICONS[item.mode] || '📅'} ${formatDate(item.date)}`}
            </Text>
          </View>
          <View style={[styles.budgetBadge, { backgroundColor: (isLyra || isAI) ? theme.teal : (BUDGET_COLORS[item.budget] || theme.teal) }]}>
            <Text style={styles.budgetText}>{isLyra || isAI ? 'AI Plan' : item.budget}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            {isLyra || isAI ? (
              <View style={styles.metaItem}>
                <Ionicons name="sparkles" size={14} color={theme.teal} />
                <Text style={[styles.metaText, { color: theme.teal, fontWeight: '700' }]}>
                  {isAI ? 'EkalGo Smart Planner' : 'Lyra Travel Architect'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.metaItem}>
                  <Ionicons name="people" size={14} color={theme.textSecondary} />
                  <Text style={styles.metaText}>{item.membersCount || 1}/{item.maxTravelers} travelers</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="compass" size={14} color={theme.textSecondary} />
                  <Text style={styles.metaText}>{item.travelType}</Text>
                </View>
              </>
            )}
          </View>

          {item.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.slice(0, 3).map((tag: any, i: number) => {
                const tagName = typeof tag === 'object' ? tag.name || tag.title : tag;
                return (
                  <View key={i} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tagName}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {item.userStatus && !isLyra && !isAI && (
            <View style={[styles.statusBadge,
            item.userStatus === 'accepted' ? { backgroundColor: theme.mode === 'dark' ? '#1A331E' : '#E8F5E9' } :
              item.userStatus === 'pending' ? { backgroundColor: theme.mode === 'dark' ? '#3B2F14' : '#FFF8E1' } : { backgroundColor: theme.mode === 'dark' ? '#3D1C1C' : '#FFEBEE' }
            ]}>
              <Text style={[styles.statusText, { color: item.userStatus === 'accepted' ? theme.success : item.userStatus === 'pending' ? theme.warning : theme.error }]}>
                {item.userStatus === 'accepted' ? '✅ Joined' :
                  item.userStatus === 'pending' ? '⏳ Pending' : '❌ Rejected'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={styles.creatorText} numberOfLines={1}>
              {isLyra || isAI ? 'Architected by EkalGo AI' : `by ${item.creator?.firstName || 'Unknown'}`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {activeTab === 'myTrips' && (
              <TouchableOpacity
                onPress={() => handleDeleteTrip(item._id, isLyra ? 'lyra' : (isAI ? 'ai_itinerary' : 'social'))}
                style={{ padding: 4 }}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
              </TouchableOpacity>
            )}
            <Ionicons name={isLyra || isAI ? "map-outline" : "chevron-forward"} size={18} color={isLyra || isAI ? theme.teal : theme.textLight} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterModal = () => (
    <Modal visible={showFilters} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎯 Smart Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Budget */}
            <Text style={styles.filterLabel}>💸 Budget</Text>
            <View style={styles.filterChips}>
              {FILTER_OPTIONS.budget.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.filterChip, filters.budget === b && styles.filterChipActive]}
                  onPress={() => setFilters((f: any) => ({ ...f, budget: f.budget === b ? undefined : b }))}
                >
                  <Text style={[styles.filterChipText, filters.budget === b && styles.filterChipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Travel Type */}
            <Text style={styles.filterLabel}>🧳 Travel Type</Text>
            <View style={styles.filterChips}>
              {FILTER_OPTIONS.travelType.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChip, filters.travelType === t && styles.filterChipActive]}
                  onPress={() => setFilters((f: any) => ({ ...f, travelType: f.travelType === t ? undefined : t }))}
                >
                  <Text style={[styles.filterChipText, filters.travelType === t && styles.filterChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mode */}
            <Text style={styles.filterLabel}>🚗 Travel Mode</Text>
            <View style={styles.filterChips}>
              {FILTER_OPTIONS.mode.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.filterChip, filters.mode === m && styles.filterChipActive]}
                  onPress={() => setFilters((f: any) => ({ ...f, mode: f.mode === m ? undefined : m }))}
                >
                  <Text style={[styles.filterChipText, filters.mode === m && styles.filterChipTextActive]}>
                    {MODE_ICONS[m]} {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tags */}
            <Text style={styles.filterLabel}>🏷️ Interests</Text>
            <View style={styles.filterChips}>
              {FILTER_OPTIONS.tags.map(t => {
                const active = filters.tags?.includes(t);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => {
                      setFilters((f: any) => {
                        const tags = f.tags || [];
                        return { ...f, tags: active ? tags.filter((x: string) => x !== t) : [...tags, t] };
                      });
                    }}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              style={[styles.filterBtn, { backgroundColor: theme.border, flex: 1 }]}
              onPress={() => { setFilters({}); setShowFilters(false); }}
            >
              <Text style={[styles.filterBtnText, { color: theme.text }]}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, { backgroundColor: theme.teal, flex: 1 }]}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.filterBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const activeFilterCount = Object.values(filters).filter(
    (v: any) => v && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const renderDurationPicker = () => {
    const DURATION_OPTIONS = [
      { id: '1', label: '1 Day Trip', days: 1 },
      { id: 'weekend', label: 'Weekend Escape (2 Days)', days: 2 },
      { id: 'mini', label: 'Mini Adventure (4 Days)', days: 4 },
      { id: 'explorer', label: 'Explorer Mode (7 Days)', days: 7 },
    ];

    return (
      <Modal visible={showDurationPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowDurationPicker(false)}
          activeOpacity={1}
        >
          <View style={styles.selectModalContent}>
            <Text style={styles.modalTitle}>⏳ Select Duration</Text>
            {DURATION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.selectOption, aiForm.days === opt.label && styles.selectOptionActive]}
                onPress={() => {
                  setAiForm(f => ({ ...f, days: opt.label, actualDays: opt.days }));
                  setShowDurationPicker(false);
                }}
              >
                <Text style={[styles.selectOptionText, aiForm.days === opt.label && styles.selectOptionTextActive]}>
                  {opt.label}
                </Text>
                {aiForm.days === opt.label && <Ionicons name="checkmark-circle" size={20} color={theme.teal} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <ScreenWrapper withTopInset={false} withBottomInset={false}>
      <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#00C9A7', '#008E7F']} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>✈️ EkalGo</Text>
          <Text style={styles.headerTagline}>Plan smarter. Travel deeper.</Text>
        </View>
        <TouchableOpacity
          style={styles.filterIcon}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={22} color={theme.textWhite} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === 'explore' && styles.tabActive]}
            onPress={() => dispatch(setActiveTab('explore'))}
          >
            <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]} numberOfLines={1}>
              🌍 Explore
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'myTrips' && styles.tabActive]}
            onPress={() => dispatch(setActiveTab('myTrips'))}
          >
            <Text style={[styles.tabText, activeTab === 'myTrips' && styles.tabTextActive]} numberOfLines={1}>
              🎒 My Trips
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'aiPlanner' && styles.tabActive]}
            onPress={() => dispatch(setActiveTab('aiPlanner'))}
          >
            <Text style={[styles.tabText, activeTab === 'aiPlanner' && styles.tabTextActive]} numberOfLines={1}>
              🪄 Trip Wizard
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* List */}
      {activeTab !== 'aiPlanner' ? (
        <FlatList
          data={data}
          renderItem={renderTripCard}
          keyExtractor={(item, index) => item._id || `trip-${index}`}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.teal} />}
          onEndReached={() => {
            if (activeTab === 'explore' && hasMore && !loading) fetchTrips(false);
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 48 }}>🗺️</Text>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'explore' ? 'No trips found' : 'No trips yet'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'explore'
                    ? 'Try adjusting your filters or check back later'
                    : 'Create your first trip and find travel companions!'}
                </Text>
                {activeTab === 'myTrips' && (
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => nav.navigate('CreateTrip')}
                  >
                    <Text style={styles.createBtnText}>+ Create Trip</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          ListFooterComponent={loading ? <ActivityIndicator color={theme.teal} style={{ marginVertical: 20 }} /> : null}
        />
      ) : (
        renderAIPlanner()
      )}

      {renderDurationPicker()}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => nav.navigate('CreateTrip')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color={theme.textWhite} />
        </LinearGradient>
      </TouchableOpacity>

      {renderFilterModal()}
      </View>
    </ScreenWrapper>
  );
}

const getStyles = (theme: any, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: Math.max(insets.top, 16),
    paddingBottom: 16,
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: '800', color: theme.textWhite },
  filterIcon: { position: 'relative', padding: 4 },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: theme.orange, borderRadius: 10, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTagline: { fontSize: 13, color: '#E0FFF9', fontWeight: '500', marginTop: 2 },
  filterBadgeText: { color: theme.textWhite, fontSize: 10, fontWeight: '800' },

  tabsWrapper: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: theme.card,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
    height: 54,
    justifyContent: 'center'
  },
  tabsContent: {
    flexDirection: 'row',
    padding: 4,
    alignItems: 'center',
    paddingRight: 20
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    marginRight: 8,
    minWidth: 100
  },
  tabActive: { backgroundColor: theme.tealLight },
  tabText: { fontSize: FONTS.md, fontWeight: '600', color: theme.textSecondary },
  tabTextActive: { color: theme.teal, fontWeight: '700' },

  card: {
    backgroundColor: theme.card, borderRadius: RADIUS.lg, marginBottom: 12,
    ...SHADOW.md, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  modeIcon: { fontSize: 32 },
  routeText: { fontSize: FONTS.lg, fontWeight: '700', color: theme.text },
  dateText: { fontSize: FONTS.sm, color: theme.textSecondary, marginTop: 2 },
  budgetBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  budgetText: { color: theme.textWhite, fontSize: FONTS.xs, fontWeight: '700' },

  cardBody: { padding: 16, paddingTop: 10 },
  metaRow: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONTS.sm, color: theme.textSecondary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tagChip: {
    backgroundColor: theme.tealLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  tagText: { fontSize: FONTS.xs, color: theme.teal, fontWeight: '600' },
  moreTagText: { fontSize: FONTS.xs, color: theme.textSecondary, alignSelf: 'center' },

  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, marginTop: 8,
  },
  statusText: { fontSize: FONTS.xs, fontWeight: '600' },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  creatorText: { fontSize: FONTS.sm, color: theme.textSecondary },

  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: FONTS.lg, fontWeight: '700', color: theme.text, marginTop: 12 },
  emptySubtitle: { fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', marginTop: 4 },
  createBtn: {
    backgroundColor: theme.teal, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: RADIUS.full, marginTop: 20,
  },
  createBtnText: { color: theme.textWhite, fontWeight: '700', fontSize: FONTS.md },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    ...SHADOW.lg,
  },
  fabGradient: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },

  // Filter Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '800', color: theme.text },
  filterLabel: { fontSize: FONTS.md, fontWeight: '700', color: theme.text, marginTop: 16, marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: theme.border, backgroundColor: theme.card,
  },
  filterChipActive: { borderColor: theme.teal, backgroundColor: theme.tealLight },
  filterChipText: { fontSize: FONTS.sm, color: theme.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: theme.teal },
  filterBtn: {
    paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  filterBtnText: { color: theme.textWhite, fontWeight: '700', fontSize: FONTS.md },

  glassCard: {
    borderRadius: 30,
    padding: 24,
    marginBottom: 20,
    backgroundColor: theme.mode === 'dark' ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.95)',
    borderWidth: 1.5,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    ...SHADOW.lg,
  },
  glassTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  glassSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  glassForm: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 20,
  },
  glassLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 10,
  },
  glassInput: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderRadius: 15,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  glassSuggestions: {
    backgroundColor: theme.card,
    borderRadius: 15,
    marginTop: 8,
    position: 'absolute',
    top: 75,
    left: 0,
    right: 0,
    zIndex: 10000,
    ...SHADOW.lg, // Use stronger shadow for overlays
    borderWidth: 1.5,
    borderColor: theme.border,
    maxHeight: 220, // Increased for better selection
    elevation: 10,
  },
  glassSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  glassSuggestionText: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  pillChip: {
    backgroundColor: theme.teal + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.teal + '30',
  },
  pillChipText: {
    fontSize: 12,
    color: theme.teal,
    fontWeight: '700',
  },
  pillRow: {
    gap: 10,
    paddingRight: 20,
  },
  durationPill: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme.border,
  },
  durationPillActive: {
    backgroundColor: theme.teal,
    borderColor: theme.teal,
    ...SHADOW.md,
  },
  durationPillText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  durationPillTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  budgetValText: {
    fontSize: 14,
    color: theme.teal,
    fontWeight: '800',
  },
  manualBudgetInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: theme.teal + '30',
  },
  manualBudgetInput: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.teal,
    minWidth: 80,
    textAlign: 'right',
  },
  rangeLimit: {
    fontSize: 12,
    color: theme.textLight,
  },
  premiumCTA: {
    marginTop: 20,
    ...Platform.select({
      ios: { ...SHADOW.lg, shadowColor: theme.teal },
      android: { elevation: 8 }
    })
  },
  premiumCTAGrad: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCTAText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.text,
    marginBottom: 16,
    marginTop: 10,
  },
  trendingRow: {
    gap: 15,
    paddingRight: 20,
  },
  trendingCard: {
    width: 120,
    height: 140,
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...SHADOW.sm,
  },
  trendingEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  trendingName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  glassSelect: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderRadius: 15,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  glassSelectText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  selectModalContent: {
    backgroundColor: theme.card,
    width: '90%',
    borderRadius: 25,
    padding: 24,
    ...SHADOW.lg,
  },
  selectOption: {
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectOptionActive: {
    backgroundColor: theme.tealLight + '10',
  },
  selectOptionText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '600',
  },
  selectOptionTextActive: {
    color: theme.teal,
    fontWeight: '800',
  },
});
