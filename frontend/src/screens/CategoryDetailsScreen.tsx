import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { Place } from '../api/placeService';
import { LinearGradient } from 'expo-linear-gradient';

const ListItem = ({ place, onMapPress }: { place: Place, onMapPress: () => void }) => {
  const theme = useAppTheme();
  return (
    <View style={[styles.listItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{place.name}</Text>
        <Text style={[styles.itemAddress, { color: theme.textSecondary }]} numberOfLines={1}>{place.address}</Text>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemDistance, { color: theme.teal }]}>📍 {place.distanceText}</Text>
          <Text style={[styles.itemRating, { color: theme.textLight }]}>⭐ {place.rating || 'N/A'}</Text>
        </View>
        <Text style={[styles.itemWhy, { color: theme.textSecondary }]} numberOfLines={1}>{place.whyThisPlace}</Text>
      </View>
      <TouchableOpacity style={[styles.goBtn, { backgroundColor: theme.teal }]} onPress={onMapPress}>
        <Ionicons name="navigate" size={18} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

export default function CategoryDetailsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { title, places, excludeIds } = route.params as { title: string, places: Place[], excludeIds?: string[] };

  // Optimized Deduplication Logic
  const filteredPlaces = useMemo(() => {
    if (!excludeIds || excludeIds.length === 0) return places;
    return places.filter(p => !excludeIds.includes(p.id));
  }, [places, excludeIds]);

  const handleMap = (p: Place) => {
    const { lat, lng } = p.location;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(p.name)}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(p.name)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    });
    Linking.openURL(url!);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.subHeader}>
        <Text style={[styles.subHeaderText, { color: theme.textSecondary }]}>
          {filteredPlaces.length} fresh spots discovered for you 💎
        </Text>
      </View>

      <FlatList
        data={filteredPlaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SPACING.md }}
        renderItem={({ item }) => <ListItem place={item} onMapPress={() => handleMap(item)} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={theme.textLight} />
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              All discovered spots are already visible in your main categories!
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.md
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  subHeader: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  subHeaderText: { fontSize: 13, fontWeight: '600' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
    borderWidth: 1,
    ...SHADOW.sm
  },
  itemInfo: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  itemAddress: { fontSize: 12, marginBottom: 6 },
  itemMeta: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  itemDistance: { fontSize: 11, fontWeight: '700' },
  itemRating: { fontSize: 11, fontWeight: '600' },
  itemWhy: { fontSize: 11 },
  goBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  empty: { textAlign: 'center', marginTop: 20, fontSize: 14, fontWeight: '600', lineHeight: 22 }
});
