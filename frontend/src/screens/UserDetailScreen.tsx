import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { userAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

const { width: W } = Dimensions.get('window');

export default function UserDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId } = route.params || {};
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (userId) {
      userAPI.getUserById(userId)
        .then(res => setProfile(res.data.user))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [userId]);

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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        {profilePhoto ? (
          <Image source={{ uri: photos[photoIndex]?.url || profilePhoto }} style={styles.heroPhoto} />
        ) : (
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.heroPhoto}>
            <Text style={{ fontSize: 80 }}>✈️</Text>
          </LinearGradient>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFillObject} />

        {/* Photo navigation tap zones */}
        <TouchableOpacity
          style={styles.prevPhotoZone}
          onPress={() => setPhotoIndex(i => Math.max(0, i - 1))}
        />
        <TouchableOpacity
          style={styles.nextPhotoZone}
          onPress={() => setPhotoIndex(i => Math.min(photos.length - 1, i + 1))}
        />

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.white} />
        </TouchableOpacity>

        {photos.length > 1 && (
          <View style={styles.dots}>
            {photos.map((_: any, i: number) => (
              <TouchableOpacity key={i} onPress={() => setPhotoIndex(i)}>
                <View style={[styles.dot, photoIndex === i && styles.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.heroInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.heroName}>{profile.firstName} {profile.lastName}</Text>
            {profile.isPhotoVerified && (
              <Ionicons name="checkmark-circle" size={20} color={COLORS.teal} />
            )}
          </View>
          <Text style={styles.heroMeta}>
            {profile.age ? `${profile.age} · ` : ''}{profile.gender || ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroCity}>
              {profile.location?.city || profile.city || 'Unknown'}{(profile.location?.city || profile.city) && (profile.location?.country || profile.country) ? ', ' : ''}{profile.location?.country || profile.country || ''}{profile.distanceKm ? ` · ${profile.distanceKm} km away` : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {profile.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {profile.interests?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Travel Interests</Text>
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

        {profile.languages?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <Text style={styles.langText}>{profile.languages.join(' · ')}</Text>
          </View>
        )}

        {profile.lookingFor?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Looking For</Text>
            <View style={styles.chipRow}>
              {profile.lookingFor.map((l: string) => (
                <View key={l} style={styles.lookingChip}>
                  <Text style={styles.lookingChipText}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 420, position: 'relative' },
  heroPhoto: { width: '100%', height: '100%', resizeMode: 'cover', alignItems: 'center', justifyContent: 'center' },
  prevPhotoZone: { position: 'absolute', left: 0, top: 0, width: '33%', height: '80%' },
  nextPhotoZone: { position: 'absolute', right: 0, top: 0, width: '67%', height: '80%' },
  backBtn: {
    position: 'absolute', top: 52, left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  dots: {
    position: 'absolute', top: 60, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: COLORS.white, width: 18 },
  heroInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  heroName: { fontSize: FONTS.xxl, fontWeight: '800', color: COLORS.white },
  heroMeta: { fontSize: FONTS.base, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroCity: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)' },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  bioText: { fontSize: FONTS.base, color: COLORS.textSecondary, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.tealLight,
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: FONTS.sm, color: COLORS.teal, fontWeight: '600' },
  langText: { fontSize: FONTS.base, color: COLORS.textSecondary },
  lookingChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.orangeLight,
  },
  lookingChipText: { fontSize: FONTS.sm, color: COLORS.orange, fontWeight: '600' },
});
