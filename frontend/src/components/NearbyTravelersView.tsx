import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, SHADOW } from '../utils/theme';
import ShimmerPlaceholder from 'react-native-shimmer-placeholder';

const { width } = Dimensions.get('window');

interface Profile {
  _id: string;
  firstName: string;
  lastName: string;
  profilePhoto?: string;
  distanceKm: number;
  activityStatus: string;
  isOnline: boolean;
  bio?: string;
}

interface NearbyTravelersViewProps {
  profiles: Profile[];
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  onProfilePress: (profile: Profile) => void;
  onLike: (profile: Profile) => void;
  onSuperLike: (profile: Profile) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  ghostMode: boolean;
}

const NearbyTravelersView = ({
  profiles,
  loading,
  onRefresh,
  refreshing,
  onProfilePress,
  onLike,
  onSuperLike,
  onLoadMore,
  hasMore,
  ghostMode,
}: NearbyTravelersViewProps) => {
  const theme = useAppTheme();
  const styles = getStyles(theme);

  const sections = [
    {
      title: 'Nearby You (< 10km)',
      data: profiles.filter((p) => p.distanceKm < 10),
    },
    {
      title: 'A Bit Further (10-100km)',
      data: profiles.filter((p) => p.distanceKm >= 10 && p.distanceKm <= 100),
    },
    {
      title: 'Global Explorers (> 100km)',
      data: profiles.filter((p) => p.distanceKm > 100),
    },
  ].filter((s) => s.data.length > 0);

  const renderItem = ({ item }: { item: Profile }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardTouchable}
        onPress={() => onProfilePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {item.profilePhoto ? (
            <Image source={{ uri: item.profilePhoto }} style={styles.image} />
          ) : (
            <View style={[styles.image, { backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person" size={32} color={theme.teal} />
            </View>
          )}
          {item.isOnline && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.firstName} {item.lastName}
            </Text>
            <View style={styles.distanceBadge}>
              <Ionicons name="location" size={12} color={theme.teal} />
              <Text style={styles.distanceText}>{item.distanceKm} km</Text>
            </View>
          </View>

          <Text style={styles.status} numberOfLines={1}>
            {item.activityStatus || 'Planning a trip'}
          </Text>
          
          {item.bio ? (
            <Text style={styles.bio} numberOfLines={1}>
              {item.bio}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.smallActionBtn, { backgroundColor: theme.gold + '15' }]}
          onPress={() => onSuperLike(item)}
        >
          <Ionicons name="star" size={18} color={theme.gold} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.smallActionBtn, { backgroundColor: theme.teal + '15' }]}
          onPress={() => onLike(item)}
        >
          <Ionicons name="heart" size={20} color={theme.teal} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  if (loading && profiles.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.shimmerCard}>
            <ShimmerPlaceholder style={styles.shimmerImg} />
            <View style={{ flex: 1, gap: 8 }}>
              <ShimmerPlaceholder style={styles.shimmerLine} />
              <ShimmerPlaceholder style={[styles.shimmerLine, { width: '60%' }]} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {ghostMode && (
        <View style={styles.ghostBanner}>
          <Ionicons name="eye-off" size={16} color="#fff" />
          <Text style={styles.ghostText}>Ghost Mode Active: You are hidden from others</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasMore && onLoadMore) onLoadMore();
        }}
        ListFooterComponent={hasMore ? (
          <ActivityIndicator size="small" color={theme.teal} style={{ marginVertical: 20 }} />
        ) : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="airplane" size={50} color={theme.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No Travelers Nearby</Text>
            <Text style={styles.emptySubtitle}>
              Try increasing your discovery radius or check back later!
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
              <Text style={styles.refreshBtnText}>Refresh Search</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    ghostBanner: {
      backgroundColor: '#6366f1',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 8,
    },
    ghostText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    sectionHeader: {
      marginTop: 24,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    },
    cardTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    imageContainer: {
      position: 'relative',
    },
    image: {
      width: 60,
      height: 60,
      borderRadius: 18,
    },
    onlineBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#10b981',
      borderWidth: 2,
      borderColor: theme.card,
    },
    infoContainer: {
      flex: 1,
      marginLeft: 14,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      maxWidth: '65%',
    },
    distanceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.tealLight + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 4,
    },
    distanceText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.teal,
    },
    status: {
      fontSize: 13,
      color: theme.teal,
      fontWeight: '600',
      marginBottom: 2,
    },
    bio: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginLeft: 8,
    },
    smallActionBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOW.sm,
    },
    loadingContainer: {
      padding: 16,
    },
    shimmerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: theme.card,
      borderRadius: 20,
      marginBottom: 12,
      gap: 12,
    },
    shimmerImg: {
      width: 60,
      height: 60,
      borderRadius: 18,
    },
    shimmerLine: {
      width: '80%',
      height: 14,
      borderRadius: 4,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    emptyIconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
      marginBottom: 24,
    },
    refreshBtn: {
      backgroundColor: theme.teal,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    refreshBtnText: {
      color: '#fff',
      fontWeight: '700',
    },
  });

export default React.memo(NearbyTravelersView);
