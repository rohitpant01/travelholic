import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
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
  const dispatch = useDispatch();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { trips, myTrips, loading, activeTab } = useSelector((s: RootState) => s.trip);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<any>({});

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
        <View style={[styles.budgetBadge, { backgroundColor: BUDGET_COLORS[item.budget] || COLORS.teal }]}>
          <Text style={styles.budgetText}>{item.budget}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people" size={14} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{item.membersCount || 1}/{item.maxTravelers} travelers</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="compass" size={14} color={COLORS.textSecondary} />
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
            item.userStatus === 'accepted' ? styles.statusAccepted :
            item.userStatus === 'pending' ? styles.statusPending : styles.statusRejected
          ]}>
            <Text style={styles.statusText}>
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
        <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
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
              <Ionicons name="close-circle" size={28} color={COLORS.textLight} />
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
              style={[styles.filterBtn, { backgroundColor: COLORS.border, flex: 1 }]}
              onPress={() => { setFilters({}); setShowFilters(false); }}
            >
              <Text style={[styles.filterBtnText, { color: COLORS.text }]}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, { backgroundColor: COLORS.teal, flex: 1 }]}
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
      <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.header}>
        <Text style={styles.headerTitle}>✈️ Trips</Text>
        <TouchableOpacity
          style={styles.filterIcon}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={22} color="#fff" />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'explore' && styles.tabActive]}
          onPress={() => dispatch(setActiveTab('explore'))}
        >
          <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>
            🌍 Explore
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myTrips' && styles.tabActive]}
          onPress={() => dispatch(setActiveTab('myTrips'))}
        >
          <Text style={[styles.tabText, activeTab === 'myTrips' && styles.tabTextActive]}>
            🎒 My Trips
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={data}
        renderItem={renderTripCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
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
        ListFooterComponent={loading ? <ActivityIndicator color={COLORS.teal} style={{ marginVertical: 20 }} /> : null}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => nav.navigate('CreateTrip')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {renderFilterModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: '800', color: '#fff' },
  filterIcon: { position: 'relative', padding: 4 },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: COLORS.orange, borderRadius: 10, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  tabs: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 4,
    ...SHADOW.sm,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md },
  tabActive: { backgroundColor: COLORS.tealLight },
  tabText: { fontSize: FONTS.md, fontWeight: '600', color: COLORS.textLight },
  tabTextActive: { color: COLORS.tealDark, fontWeight: '700' },

  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, marginBottom: 12,
    ...SHADOW.md, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modeIcon: { fontSize: 32 },
  routeText: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  dateText: { fontSize: FONTS.sm, color: COLORS.textSecondary, marginTop: 2 },
  budgetBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  budgetText: { color: '#fff', fontSize: FONTS.xs, fontWeight: '700' },

  cardBody: { padding: 16, paddingTop: 10 },
  metaRow: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONTS.sm, color: COLORS.textSecondary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tagChip: {
    backgroundColor: COLORS.tealLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  tagText: { fontSize: FONTS.xs, color: COLORS.tealDark, fontWeight: '600' },
  moreTagText: { fontSize: FONTS.xs, color: COLORS.textLight, alignSelf: 'center' },

  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, marginTop: 8,
  },
  statusAccepted: { backgroundColor: '#E8F5E9' },
  statusPending: { backgroundColor: '#FFF8E1' },
  statusRejected: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: FONTS.xs, fontWeight: '600' },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  creatorText: { fontSize: FONTS.sm, color: COLORS.textLight },

  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  emptySubtitle: { fontSize: FONTS.md, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  createBtn: {
    backgroundColor: COLORS.teal, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: RADIUS.full, marginTop: 20,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.md },

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
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text },
  filterLabel: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  filterChipActive: { borderColor: COLORS.teal, backgroundColor: COLORS.tealLight },
  filterChipText: { fontSize: FONTS.sm, color: COLORS.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.tealDark },
  filterBtn: {
    paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  filterBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.md },
});
