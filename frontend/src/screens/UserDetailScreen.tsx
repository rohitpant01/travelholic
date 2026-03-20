import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, Platform, Modal
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { userAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

const { width: W } = Dimensions.get('window');

const formatLastSeen = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return 'Online now';
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  return `Last seen on ${d.toLocaleDateString()}`;
};

export default function UserDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId } = route.params || {};
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showTrips, setShowTrips] = useState(false);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      const res = await userAPI.getUserById(userId);
      setProfile(res.data.user);
    } catch (err) {
      console.error('Load profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = () => {
    navigation.navigate('Chat', { 
      userId, 
      userName: `${profile.firstName} ${profile.lastName}`,
      userPhoto: profile.photos?.find((p: any) => p.isProfile)?.url || profile.photos?.[0]?.url,
      matchId: '' // Explicitly pass empty if not matched yet
    });
  };

  const INTEREST_EMOJIS: Record<string, string> = {
    Mountains: '🏔️', Beaches: '🏖️', 'Road Trips': '🚗', Trekking: '🥾',
    Camping: '⛺', Photography: '📸', 'Food Travel': '🍜', 'Cultural Travel': '🏛️',
    'Adventure Sports': '🪂', Backpacking: '🎒', 'Solo Travel': '🧍', Cruises: '🚢',
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={COLORS.teal} />
    </View>
  );

  if (!profile) return (
    <View style={styles.loader}>
      <Text style={{ color: COLORS.textSecondary }}>Profile not found</Text>
    </View>
  );

  const photos = profile.photos || [];
  const profilePhoto = photos.find((p: any) => p.isProfile)?.url || photos[0]?.url;

  return (
    <View style={styles.mainWrapper}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero */}
        <View style={styles.hero}>
          {profilePhoto ? (
            <Image source={{ uri: photos[photoIndex]?.url || profilePhoto }} style={styles.heroPhoto} />
          ) : (
            <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.heroPhoto}>
              <Text style={{ fontSize: 80 }}>✈️</Text>
            </LinearGradient>
          )}
          
          <LinearGradient 
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.85)']} 
            style={StyleSheet.absoluteFillObject} 
          />

          {/* Photo navigation tap zones */}
          <View style={styles.tapZones}>
            <TouchableOpacity
              style={styles.tapZone}
              onPress={() => setPhotoIndex(i => Math.max(0, i - 1))}
            />
            <TouchableOpacity
              style={styles.tapZone}
              onPress={() => setPhotoIndex(i => Math.min(photos.length - 1, i + 1))}
            />
          </View>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color={COLORS.white} />
          </TouchableOpacity>

          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_: any, i: number) => (
                <View key={i} style={[styles.dot, photoIndex === i && styles.dotActive]} />
              ))}
            </View>
          )}

          <View style={styles.heroInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.heroName}>{profile.firstName} {profile.lastName}, {profile.age}</Text>
              {profile.isPhotoVerified && (
                <Ionicons name="checkmark-circle" size={22} color={COLORS.teal} style={{ marginLeft: 6 }} />
              )}
            </View>
            
            <View style={styles.statusRow}>
              {profile.isOnline ? (
                <View style={[styles.statusBadge, { backgroundColor: COLORS.success }]}>
                  <Text style={styles.statusBadgeText}>ACTIVE NOW</Text>
                </View>
              ) : (
                <Text style={styles.lastSeenText}>{formatLastSeen(profile.lastSeen)}</Text>
              )}
              <View style={styles.locationTag}>
                <Ionicons name="location" size={14} color={COLORS.white} />
                <Text style={styles.locationText}>
                  {profile.location?.city || profile.city || 'Traveler'} · {profile.distanceKm || '0'}km
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Social Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => setShowTrips(true)}>
              <Text style={styles.statNumber}>{profile.tripsCompleted || 0}</Text>
              <Text style={styles.statLabel}>Trips Completed</Text>
            </TouchableOpacity>
            <View style={[styles.statItem, styles.statDivider]}>
              <Text style={styles.statNumber}>{profile.matchesCount || 0}</Text>
              <Text style={styles.statLabel}>Total Matches</Text>
            </View>
            <View style={styles.statItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons 
                  name={profile.memberStatus === 'Elite' ? 'crown' : profile.memberStatus === 'Premium' ? 'star' : 'account-check'} 
                  size={16} 
                  color={profile.memberStatus === 'Elite' ? COLORS.gold : profile.memberStatus === 'Premium' ? COLORS.teal : COLORS.textSecondary} 
                />
                <Text style={[styles.statNumber, { fontSize: 16 }]}>{profile.memberStatus || 'Free'}</Text>
              </View>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>
              {profile.bio || `Passionate traveler exploring the world. Let's connect and plan our next adventure together! 🌎`}
            </Text>
          </View>

          {/* Travel Plan Card */}
          {(profile.destination?.city || profile.origin?.city) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Expedition</Text>
              <LinearGradient 
                colors={[COLORS.tealLight, 'rgba(230, 246, 245, 0.5)']} 
                style={styles.travelCard}
              >
                <View style={styles.travelTimeline}>
                  <View style={styles.timelineNode}>
                    <Ionicons name="radio-button-on" size={16} color={COLORS.teal} />
                    <View style={styles.timelineLine} />
                    <Ionicons name="airplane" size={18} color={COLORS.teal} style={{ marginVertical: 4 }} />
                    <View style={styles.timelineLine} />
                    <Ionicons name="location" size={18} color={COLORS.orange} />
                  </View>
                  <View style={styles.timelineContent}>
                    <View>
                      <Text style={styles.travelLabel}>Origin</Text>
                      <Text style={styles.travelValue}>{profile.origin?.city || 'Not specified'}</Text>
                    </View>
                    <View style={{ marginTop: 24 }}>
                      <Text style={styles.travelLabel}>Destination</Text>
                      <Text style={styles.travelValue}>{profile.destination?.city || 'Exploring...'}</Text>
                    </View>
                  </View>
                  <View style={styles.travelDateBox}>
                    <Text style={styles.dateMonth}>
                      {profile.travelDate ? new Date(profile.travelDate).toLocaleString('default', { month: 'short' }) : '---'}
                    </Text>
                    <Text style={styles.dateDay}>
                      {profile.travelDate ? new Date(profile.travelDate).getDate() : '--'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Interests */}
          {profile.interests?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Travel Styles</Text>
              <View style={styles.chipRow}>
                {profile.interests.map((i: string) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipEmoji}>{INTEREST_EMOJIS[i] || '✈️'}</Text>
                    <Text style={styles.chipLabel}>{i}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            {profile.languages?.length > 0 && (
              <View style={[styles.detailCard, { flex: 1.5 }]}>
                <Ionicons name="language" size={20} color={COLORS.teal} />
                <Text style={styles.detailCardLabel}>Languages</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                   {profile.languages.map((l: string, idx: number) => (
                     <Text key={l} style={styles.detailCardValue}>
                       {l}{idx < profile.languages.length - 1 ? ',' : ''}
                     </Text>
                   ))}
                </View>
              </View>
            )}
            {profile.gender && (
              <View style={styles.detailCard}>
                <Ionicons name="person" size={20} color={COLORS.teal} />
                <Text style={styles.detailCardLabel}>Gender</Text>
                <Text style={styles.detailCardValue}>{profile.gender}</Text>
              </View>
            )}
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <Modal
        visible={showTrips}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTrips(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip History</Text>
              <TouchableOpacity onPress={() => setShowTrips(false)}>
                <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {profile.completedTrips && profile.completedTrips.length > 0 ? (
                profile.completedTrips.map((trip: any, idx: number) => (
                  <View key={idx} style={styles.tripTimelineItem}>
                    <View style={styles.tripTimelineNode}>
                       <View style={styles.tripDot} />
                       {idx < profile.completedTrips.length - 1 && <View style={styles.tripLine} />}
                    </View>
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripCities}>{trip.origin.city} ✈️ {trip.destination.city}</Text>
                      <View style={styles.tripMeta}>
                          <Ionicons name="calendar-outline" size={14} color={COLORS.teal} />
                          <Text style={styles.tripMetaText}>
                            {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                          </Text>
                          <View style={styles.metaDot} />
                          <Ionicons name="time-outline" size={14} color={COLORS.teal} />
                          <Text style={styles.tripMetaText}>{trip.duration} days</Text>
                      </View>
                      {trip.details && (
                        <Text style={styles.tripDetailsText}>{trip.details}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Ionicons name="airplane-outline" size={50} color={COLORS.tealLight} />
                  <Text style={{ marginTop: 15, color: COLORS.textSecondary, fontWeight: '600' }}>No trips completed yet</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Action Buttons Footer */}
      <View style={styles.footer}>
        <LinearGradient 
          colors={['transparent', 'rgba(255,255,255,0.9)', COLORS.white]} 
          style={styles.footerGradient} 
        />
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
            <LinearGradient 
              colors={[COLORS.teal, COLORS.tealDark]} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }} 
              style={styles.messageBtnGradient}
            >
              <Ionicons name="chatbubble-ellipses" size={22} color={COLORS.white} />
              <Text style={styles.messageBtnText}>Message Traveler</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 500, position: 'relative' },
  heroPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },
  backBtn: {
    position: 'absolute', top: 52, left: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  dots: {
    position: 'absolute', top: 60, left: 60, right: 60,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: COLORS.white },
  heroInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 25, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: { fontSize: 32, fontWeight: '800', color: COLORS.white, letterSpacing: -0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: '900', color: COLORS.white },
  lastSeenText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  locationTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  locationText: { fontSize: 13, color: COLORS.white, fontWeight: '600' },
  
  content: { marginTop: -25, backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, backgroundColor: '#F8F9FB', borderRadius: 20, marginBottom: 25 },
  statItem: { alignItems: 'center', flex: 1 },
  statDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E8EBF0' },
  statNumber: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },

  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 15 },
  bioText: { fontSize: 16, color: COLORS.textSecondary, lineHeight: 24 },

  travelCard: { borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' },
  travelTimeline: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineNode: { alignItems: 'center', width: 24, marginRight: 15 },
  timelineLine: { width: 2, height: 25, backgroundColor: 'rgba(0,128,128,0.2)', borderRadius: 1 },
  timelineContent: { flex: 1 },
  travelLabel: { fontSize: 11, fontWeight: '800', color: COLORS.teal, textTransform: 'uppercase', letterSpacing: 1 },
  travelValue: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  travelDateBox: { backgroundColor: COLORS.white, padding: 12, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  dateMonth: { fontSize: 12, fontWeight: '800', color: COLORS.orange, textTransform: 'uppercase' },
  dateDay: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 15,
    backgroundColor: '#F0F7F7', borderWidth: 1, borderColor: 'rgba(0,128,128,0.05)',
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 14, color: COLORS.teal, fontWeight: '700' },

  detailsGrid: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  detailCard: { flex: 1, backgroundColor: '#F8F9FB', padding: 15, borderRadius: 18, gap: 5 },
  detailCardLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  detailCardValue: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, justifyContent: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  footerGradient: { ...StyleSheet.absoluteFillObject },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  followBtn: { flex: 1, height: 56, borderRadius: 18, backgroundColor: COLORS.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...SHADOW.md },
  followingBtn: { backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.teal },
  followBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  followingBtnText: { color: COLORS.teal },
  messageBtn: { flex: 1, height: 56, borderRadius: 18, overflow: 'hidden', ...SHADOW.md },
  messageBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  messageBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

  // Modal & Trip Timeline Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, height: '70%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 25, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  tripTimelineItem: { flexDirection: 'row', marginBottom: 25 },
  tripTimelineNode: { alignItems: 'center', width: 20, marginRight: 15 },
  tripDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.teal, borderWidth: 2, borderColor: COLORS.tealLight },
  tripLine: { width: 2, flex: 1, backgroundColor: COLORS.tealLight, marginVertical: 4 },
  tripInfo: { flex: 1, backgroundColor: '#F8FBFA', padding: 15, borderRadius: 18 },
  tripCities: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  tripMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  tripMetaText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', marginLeft: 4 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.textSecondary, marginHorizontal: 8 },
  tripDetailsText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 10, lineHeight: 20, fontStyle: 'italic' },
});
