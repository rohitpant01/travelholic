import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  TextInput, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { tripAPI } from '../api/services';
import { setTrips, appendTrips, setMyTrips, setLoading, setActiveTab } from '../store/slices/tripSlice';
import { RootState } from '../store';

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
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
    days: '3',
    customDays: '',
    budget: '10000',
    customBudget: '',
    travelType: 'Solo',
    interests: [] as string[],
  });

  const [sourceSuggestions, setSourceSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);

  const fetchSuggestions = async (q: string, setSugg: Function) => {
    if (q.length < 3) {
      setSugg([]);
      return;
    }
    try {
      setFetchingSuggestions(true);
      const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''; 
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${q}&types=(cities)&key=${key}`
      );
      const data = await res.json();
      
      // 🔍 DEBUG LOG: Catch API key / Permission issues
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn(`[Google Places Error] Status: ${data.status}`);
        console.warn(`[Google Places Error] Message: ${data.error_message || 'N/A'}`);
      }

      if (data.predictions) {
        setSugg(data.predictions);
      }
    } catch (e) {
      console.error('Autocomplete error:', e);
    } finally {
      setFetchingSuggestions(false);
    }
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
  }, [filters, page]);

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

  const renderAIPlanner = () => (
    <KeyboardWrapper 
      backgroundColor="transparent"
      contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }}
    >
      <View style={styles.aiCard}>
        <LinearGradient colors={['#FF6B35', '#FF8A5C']} style={styles.aiHeaderGrad}>
          <Text style={styles.aiTitle}>Magic AI Travel Planner 🪄</Text>
          <Text style={styles.aiSubtitle}>Generate a pro-level itinerary in seconds</Text>
        </LinearGradient>

        <View style={styles.aiFormBody}>
          {/* Source City */}
          <Text style={styles.aiLabel}>🗺️ Starting From?</Text>
          <TextInput
            style={styles.aiInput}
            placeholder="e.g. Delhi, Mumbai..."
            placeholderTextColor={theme.textLight}
            value={aiForm.sourceCity}
            onChangeText={(t) => {
              setAiForm(f => ({ ...f, sourceCity: t }));
              fetchSuggestions(t, setSourceSuggestions);
            }}
          />
          {sourceSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
               {sourceSuggestions.map((s, i) => (
                 <TouchableOpacity 
                   key={i} 
                   style={styles.suggestionItem}
                   onPress={() => {
                     setAiForm(f => ({ ...f, sourceCity: s.description }));
                     setSourceSuggestions([]);
                   }}
                 >
                   <Ionicons name="location-outline" size={16} color={theme.teal} />
                   <Text style={styles.suggestionText}>{s.description}</Text>
                 </TouchableOpacity>
               ))}
            </View>
          )}

          {/* Destination */}
          <Text style={styles.aiLabel}>📍 Where to?</Text>
          <TextInput
            style={styles.aiInput}
            placeholder="e.g. Manali, Goa, Japan..."
            placeholderTextColor={theme.textLight}
            value={aiForm.destination}
            onChangeText={(t) => {
              setAiForm(f => ({ ...f, destination: t }));
              fetchSuggestions(t, setDestSuggestions);
            }}
          />
          {destSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
               {destSuggestions.map((s, i) => (
                 <TouchableOpacity 
                   key={i} 
                   style={styles.suggestionItem}
                   onPress={() => {
                     setAiForm(f => ({ ...f, destination: s.description }));
                     setDestSuggestions([]);
                   }}
                 >
                   <Ionicons name="location-outline" size={16} color={theme.teal} />
                   <Text style={styles.suggestionText}>{s.description}</Text>
                 </TouchableOpacity>
               ))}
            </View>
          )}

          {/* Days */}
          <Text style={styles.aiLabel}>⏳ Duration (Days)</Text>
          <View style={styles.aiChipRow}>
            {['1', '2', '3', '4', '5'].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.aiChip, aiForm.days === d && styles.aiChipActive]}
                onPress={() => setAiForm(f => ({ ...f, days: d }))}
              >
                <Text style={[styles.aiChipText, aiForm.days === d && styles.aiChipTextActive]}>{d} Days</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Budget */}
          <Text style={styles.aiLabel}>💰 Budget (INR)</Text>
          <View style={styles.aiChipRow}>
            {BUDGET_OPTIONS.concat(['Other']).map(b => (
              <TouchableOpacity
                key={b}
                style={[styles.aiChip, aiForm.budget === b && styles.aiChipActive]}
                onPress={() => setAiForm(f => ({ ...f, budget: b }))}
              >
                <Text style={[styles.aiChipText, aiForm.budget === b && styles.aiChipTextActive]}>
                  {b === 'Other' ? 'Other ✏️' : `₹${parseInt(b).toLocaleString('en-IN')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {aiForm.budget === 'Other' && (
            <TextInput
              style={[styles.aiInput, { marginTop: 10 }]}
              placeholder="Enter budget in INR"
              keyboardType="numeric"
              value={aiForm.customBudget}
              onChangeText={(t) => setAiForm(f => ({ ...f, customBudget: t }))}
            />
          )}

          {/* Travel Type */}
          <Text style={styles.aiLabel}>🧳 Travel Type</Text>
          <View style={styles.aiChipRow}>
            {['Solo', 'Couple', 'Group'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.aiChip, aiForm.travelType === t && styles.aiChipActive]}
                onPress={() => setAiForm(f => ({ ...f, travelType: t }))}
              >
                <Text style={[styles.aiChipText, aiForm.travelType === t && styles.aiChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Interests */}
          <Text style={styles.aiLabel}>🏷️ Interests</Text>
          <View style={styles.aiChipRow}>
            {FILTER_OPTIONS.tags.map(t => {
              const active = aiForm.interests.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.aiChip, active && styles.aiChipActive]}
                  onPress={() => {
                    setAiForm(f => ({
                      ...f,
                      interests: active ? f.interests.filter(x => x !== t) : [...f.interests, t]
                    }));
                  }}
                >
                  <Text style={[styles.aiChipText, active && styles.aiChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.generateBtn}
            onPress={() => {
              if (!aiForm.destination) {
                Alert.alert('Missing Info', 'Where would you like to go?');
                return;
              }
              const finalBudget = aiForm.budget === 'Other' ? aiForm.customBudget : aiForm.budget;
              
              if (!aiForm.days || isNaN(parseInt(aiForm.days))) {
                Alert.alert('Missing Info', 'Please select a duration.');
                return;
              }
              if (!finalBudget || isNaN(parseInt(finalBudget))) {
                Alert.alert('Missing Info', 'Please enter a valid budget.');
                return;
              }

              nav.navigate('AIItinerary', { 
                trip: {
                  source: { city: aiForm.sourceCity || 'Local' },
                  destination: { city: aiForm.destination },
                  duration: parseInt(aiForm.days),
                  budget: `₹${parseInt(finalBudget).toLocaleString('en-IN')}`,
                  travelType: aiForm.travelType,
                  interests: aiForm.interests,
                } 
              });
            }}
          >
            <LinearGradient colors={['#FF6B35', '#FF8A5C']} style={styles.generateGrad}>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.generateText}>Generate Magic Itinerary ✨</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardWrapper>
  );

  const renderTripCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => nav.navigate('TripDetail', { tripId: item._id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.modeIcon}>{MODE_ICONS[item.mode] || '🌍'}</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.routeText}>
            {item.source?.city} → {item.destination?.city}
          </Text>
          <Text style={styles.dateText}>{MODE_ICONS[item.mode] || '📅'} {formatDate(item.date)}</Text>
        </View>
        <View style={[styles.budgetBadge, { backgroundColor: BUDGET_COLORS[item.budget] || theme.teal }]}>
          <Text style={styles.budgetText}>{item.budget}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{item.membersCount || 1}/{item.maxTravelers} travelers</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="compass" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{item.travelType}</Text>
          </View>
        </View>

        {item.tags?.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 3).map((tag: string, i: number) => (
              <View key={i} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {item.tags.length > 3 && (
              <Text style={styles.moreTagText}>+{item.tags.length - 3}</Text>
            )}
          </View>
        )}

        {item.userStatus && (
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.creatorText}>
            by {item.creator?.firstName || 'Unknown'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
      </View>
    </TouchableOpacity>
  );

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.header}>
        <Text style={styles.headerTitle}>✈️ Trips</Text>
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
              🪄 AI Planner
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* List */}
      {activeTab !== 'aiPlanner' ? (
        <FlatList
          data={data}
          renderItem={renderTripCard}
          keyExtractor={(item) => item._id}
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
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: '800', color: theme.textWhite },
  filterIcon: { position: 'relative', padding: 4 },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: theme.orange, borderRadius: 10, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
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
 
  // AI Planner Styles
  aiCard: {
    backgroundColor: theme.card, borderRadius: 24, padding: 0,
    overflow: 'hidden', ...SHADOW.lg, marginBottom: 20,
  },
  aiHeaderGrad: { padding: 24, alignItems: 'center' },
  aiTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  aiSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },
  aiFormBody: { padding: 20 },
  aiLabel: { fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 16, marginBottom: 12 },
  aiInput: {
    backgroundColor: theme.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: theme.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: theme.text,
  },
  aiChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  aiChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card,
  },
  aiChipActive: { borderColor: theme.teal, backgroundColor: theme.tealLight },
  aiChipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '600' },
  aiChipTextActive: { color: theme.teal, fontWeight: '700' },
  generateBtn: { marginTop: 32, borderRadius: 16, overflow: 'hidden', ...SHADOW.md },
  generateGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, gap: 10,
  },
  generateText: { color: '#fff', fontSize: 18, fontWeight: '800' },
 
  // Autocomplete Styles
  suggestionsContainer: {
    backgroundColor: theme.card,
    borderRadius: RADIUS.md,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.border,
    maxHeight: 200,
    zIndex: 1000,
    ...SHADOW.md,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
});
