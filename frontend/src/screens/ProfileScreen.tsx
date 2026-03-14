import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

const { width: W } = Dimensions.get('window');

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { user } = useSelector((s: RootState) => s.auth);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          dispatch(logout());
        },
      },
    ]);
  };

  const profilePhoto = user?.photos?.find(p => p.isProfile)?.url || user?.photos?.[0]?.url;
  const photos = user?.photos || [];

  const interests = user?.interests || [];
  const languages = user?.languages || [];
  const lookingFor = user?.lookingFor || [];

  const INTEREST_EMOJIS: Record<string, string> = {
    Mountains: '🏔️', Beaches: '🏖️', 'Road Trips': '🚗', Trekking: '🥾',
    Camping: '⛺', Photography: '📸', 'Food Travel': '🍜', 'Cultural Travel': '🏛️',
    'Adventure Sports': '🪂', Backpacking: '🎒', 'Solo Travel': '🧍', Cruises: '🚢',
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero photo section */}
      <View style={styles.heroContainer}>
        {profilePhoto ? (
          <Image source={{ uri: photos[activePhotoIndex]?.url || profilePhoto }} style={styles.heroPhoto} />
        ) : (
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.heroPhoto}>
            <Text style={{ fontSize: 80 }}>✈️</Text>
          </LinearGradient>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.heroOverlay} />

        {/* Photo navigation tap zones */}
        <TouchableOpacity
          style={styles.prevPhotoZone}
          onPress={() => setActivePhotoIndex(i => Math.max(0, i - 1))}
        />
        <TouchableOpacity
          style={styles.nextPhotoZone}
          onPress={() => setActivePhotoIndex(i => Math.min(photos.length - 1, i + 1))}
        />

        {/* Photo dots */}
        {photos.length > 1 && (
          <View style={styles.photoDots}>
            {photos.map((_: any, i: number) => (
              <TouchableOpacity key={i} onPress={() => setActivePhotoIndex(i)}>
                <View style={[styles.photoDot, activePhotoIndex === i && styles.photoDotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.editPhotoBtn}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Ionicons name="pencil" size={18} color={COLORS.white} />
        </TouchableOpacity>

        {/* Name + verified */}
        <View style={styles.heroInfo}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>
              {user?.firstName} {user?.lastName}
            </Text>
            {user?.isPhotoVerified && (
              <Ionicons name="checkmark-circle" size={22} color={COLORS.teal} />
            )}
          </View>
          <Text style={styles.heroAge}>
            {user?.age ? `${user.age} · ` : ''}{user?.gender || ''}
          </Text>
          <View style={styles.heroLocation}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroLocationText}>
              {user?.location?.city || user?.city || 'Unknown'}{(user?.location?.city || user?.city) && (user?.location?.country || user?.country) ? ', ' : ''}{user?.location?.country || user?.country || ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{user?.likesReceived || 0}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{user?.matchesCount || 0}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{user?.tripsCompleted || 0}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{user?.countriesVisited?.length || 0}</Text>
          <Text style={styles.statLabel}>Countries</Text>
        </View>
      </View>

      {/* Bio */}
      {user?.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Me</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>
      ) : null}

      {/* Interests */}
      {interests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel Interests</Text>
          <View style={styles.chipRow}>
            {interests.map(i => (
              <View key={i} style={styles.interestChip}>
                <Text style={styles.interestEmoji}>{INTEREST_EMOJIS[i] || '✈️'}</Text>
                <Text style={styles.interestLabel}>{i}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Languages</Text>
          <View style={styles.chipRow}>
            {languages.map(l => (
              <View key={l} style={styles.langChip}>
                <Text style={styles.langLabel}>🗣️ {l}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Looking For */}
      {lookingFor.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking For</Text>
          <View style={styles.chipRow}>
            {lookingFor.map(l => (
              <View key={l} style={styles.lookingChip}>
                <Text style={styles.lookingLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Travel History */}
      {(user?.countriesVisited?.length || user?.dreamDestination) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel History</Text>
          {user?.lastVisitedPlace && (
            <View style={styles.travelRow}>
              <Ionicons name="airplane" size={16} color={COLORS.teal} />
              <Text style={styles.travelText}>Last visited: <Text style={styles.travelValue}>{user.lastVisitedPlace}</Text></Text>
            </View>
          )}
          {user?.dreamDestination && (
            <View style={styles.travelRow}>
              <Ionicons name="star" size={16} color={COLORS.gold} />
              <Text style={styles.travelText}>Dream destination: <Text style={styles.travelValue}>{user.dreamDestination}</Text></Text>
            </View>
          )}
          {user?.countriesVisited && user.countriesVisited.length > 0 && (
            <View style={styles.travelRow}>
              <Ionicons name="earth" size={16} color={COLORS.orange} />
              <Text style={styles.travelText}>
                Visited: <Text style={styles.travelValue}>{user.countriesVisited.join(', ')}</Text>
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actionBtns}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Ionicons name="pencil-outline" size={20} color={COLORS.teal} />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  heroContainer: { height: 380, position: 'relative' },
  heroPhoto: { width: '100%', height: '100%', resizeMode: 'cover', alignItems: 'center', justifyContent: 'center' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  prevPhotoZone: { position: 'absolute', left: 0, top: 0, width: '33%', height: '80%' },
  nextPhotoZone: { position: 'absolute', right: 0, top: 0, width: '67%', height: '80%' },
  photoDots: {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  photoDotActive: { backgroundColor: COLORS.white, width: 18 },
  editPhotoBtn: {
    position: 'absolute', top: 52, right: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  heroInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { fontSize: FONTS.xxl, fontWeight: '800', color: COLORS.white },
  heroAge: { fontSize: FONTS.base, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heroLocationText: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)' },
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    marginHorizontal: 20, marginTop: -24,
    borderRadius: 20, padding: 16, ...SHADOW.md, zIndex: 10,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.teal },
  statLabel: { fontSize: FONTS.xs, color: COLORS.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  bioText: { fontSize: FONTS.base, color: COLORS.textSecondary, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.tealLight, borderWidth: 1, borderColor: COLORS.teal + '40',
  },
  interestEmoji: { fontSize: 15 },
  interestLabel: { fontSize: FONTS.sm, color: COLORS.teal, fontWeight: '600' },
  langChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.goldLight,
  },
  langLabel: { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '500' },
  lookingChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.orangeLight,
  },
  lookingLabel: { fontSize: FONTS.sm, color: COLORS.orange, fontWeight: '600' },
  travelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  travelText: { flex: 1, fontSize: FONTS.base, color: COLORS.textSecondary },
  travelValue: { color: COLORS.text, fontWeight: '600' },
  actionBtns: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 20, marginTop: 28,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderColor: COLORS.teal, borderRadius: RADIUS.full, paddingVertical: 14,
  },
  editBtnText: { color: COLORS.teal, fontWeight: '700', fontSize: FONTS.base },
  settingsBtn: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16,
    paddingVertical: 14, borderRadius: RADIUS.full,
    backgroundColor: '#FEF0EF',
  },
  logoutText: { color: COLORS.error, fontWeight: '700', fontSize: FONTS.base },
});
