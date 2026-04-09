import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  PanResponder, Dimensions, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';

const { width: W, height: H } = Dimensions.get('window');
const CARD_WIDTH = W - 32;
const SWIPE_THRESHOLD = W * 0.3;

export interface Profile {
  _id: string;
  firstName: string;
  lastName?: string;
  age?: number;
  gender?: string;
  bio?: string;
  photos?: any[];
  interests?: string[];
  location?: { city?: string; country?: string };
  isPhotoVerified?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  distanceKm?: number;
  lookingFor?: string[];
  origin?: { city?: string };
  destination?: { city?: string };
  travelDate?: string;
  city?: string;
  activityStatus?: string;
}

interface TravelerDiscoveryCardProps {
  profile: Profile;
  onPressProfile?: (profile: Profile) => void;
}

export default function TravelerDiscoveryCard({ 
  profile, 
  onPressProfile
}: TravelerDiscoveryCardProps) {
  const theme = useAppTheme();
  const styles = getStyles(theme);

  if (!profile) return null; // Safety guard against empty cards

  const [photoIndex, setPhotoIndex] = useState(0);
  const profilePhoto = profile.photos?.find(p => p.isProfile)?.url || profile.photos?.[0]?.url;

  const photos = profile.photos || [];

  return (
    <View style={styles.card}>
      <View style={styles.photoContainer}>
        {profilePhoto ? (
          <Image source={{ uri: photos[photoIndex]?.url || profilePhoto }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <Text style={{ fontSize: 64 }}>✈️</Text>
          </View>
        )}

        {/* Tap areas for photo navigation */}
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity 
            style={styles.prevPhotoZone} 
            onPress={() => setPhotoIndex(i => Math.max(0, i - 1))} 
            activeOpacity={1} 
          />
          <TouchableOpacity 
            style={styles.nextPhotoZone} 
            onPress={() => setPhotoIndex(i => Math.min(photos.length - 1, i + 1))} 
            activeOpacity={1} 
          />
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.gradient}
        />

        <TouchableOpacity 
          style={styles.info} 
          onPress={() => onPressProfile?.(profile)}
          activeOpacity={0.9}
        >
          <View style={styles.mainInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.firstName}</Text>
              {profile.age && <Text style={styles.age}>{profile.age}</Text>}
              {profile.isPhotoVerified && (
                <Ionicons name="checkmark-circle" size={18} color={theme.teal} />
              )}
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.location}>
                {profile.location?.city || profile.city || 'Adventure Land'}{profile.distanceKm ? ` · ${profile.distanceKm.toFixed(0)}km away` : ''}
              </Text>
            </View>
          </View>

          {profile.bio && (
            <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
          )}

          <View style={styles.footer}>
            <View style={styles.tagRow}>
              {profile.interests?.slice(0, 3).map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>

            <View style={styles.moreIcon}>
              <Ionicons name="information-circle-outline" size={24} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: H * 0.58,
    borderRadius: 24,
    backgroundColor: theme.card,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  photoContainer: { flex: 1, position: 'relative' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  noPhoto: { backgroundColor: theme.tealLight, alignItems: 'center', justifyContent: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  
  prevPhotoZone: { position: 'absolute', left: 0, top: 0, width: '35%', height: '80%' },
  nextPhotoZone: { position: 'absolute', right: 0, top: 0, width: '65%', height: '80%' },
  
  info: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingTop: 60 },
  mainInfo: { marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 28, fontWeight: '900', color: '#fff' },
  age: { fontSize: 24, fontWeight: '400', color: 'rgba(255,255,255,0.9)' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  location: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  
  bio: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 20, marginBottom: 16 },
  
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', gap: 8 },
  tag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100 },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  moreIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
