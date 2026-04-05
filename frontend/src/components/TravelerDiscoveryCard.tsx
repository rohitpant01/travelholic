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
}

interface TravelerDiscoveryCardProps {
  profile: Profile;
  onLike: () => void;
  onSkip: () => void;
  onSuperLike: () => void;
  isTop: boolean;
  onPressProfile?: (profile: Profile) => void;
}

export default function TravelerDiscoveryCard({ 
  profile, 
  onLike, 
  onSkip, 
  onSuperLike, 
  isTop,
  onPressProfile
}: TravelerDiscoveryCardProps) {
      const theme = useAppTheme();
  const styles = getStyles(theme);
  const pan = useRef(new Animated.ValueXY()).current;
  const [photoIndex, setPhotoIndex] = useState(0);
  const profilePhoto = profile.photos?.find(p => p.isProfile)?.url || profile.photos?.[0]?.url;

  const rotate = pan.x.interpolate({
    inputRange: [-W / 2, 0, W / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, W * 0.25],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const skipOpacity = pan.x.interpolate({
    inputRange: [-W * 0.25, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return isTop && (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10);
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: W * 1.5, y: gesture.dy },
            duration: 250, useNativeDriver: false,
          }).start(onLike);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: -W * 1.5, y: gesture.dy },
            duration: 250, useNativeDriver: false,
          }).start(onSkip);
        } else if (gesture.dy < -SWIPE_THRESHOLD * 0.8) {
          Animated.timing(pan, {
            toValue: { x: gesture.dx, y: -H },
            duration: 250, useNativeDriver: false,
          }).start(onSuperLike);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const photos = profile.photos || [];

  return (
    <Animated.View
      style={[
        styles.card,
        isTop && {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
        },
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <View style={styles.photoContainer}>
        {profilePhoto ? (
          <Image source={{ uri: photos[photoIndex]?.url || profilePhoto }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <Text style={{ fontSize: 64 }}>✈️</Text>
          </View>
        )}

        {/* Swipe indicators */}
        <View style={styles.photoNav}>
          {photos.map((_, idx) => (
            <View key={idx} style={[styles.photoDot, idx === photoIndex && styles.photoDotActive]} />
          ))}
        </View>

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

        {/* Action Labels */}
        {isTop && (
          <>
            <Animated.View style={[styles.label, styles.likeLabel, { opacity: likeOpacity }]}>
              <Text style={styles.labelText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.label, styles.nopeLabel, { opacity: skipOpacity }]}>
              <Text style={styles.labelText}>NOPE</Text>
            </Animated.View>
          </>
        )}

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
    </Animated.View>
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
  
  photoNav: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  photoDot: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  photoDotActive: {
    backgroundColor: '#fff',
  },
  
  prevPhotoZone: { position: 'absolute', left: 0, top: 0, width: '35%', height: '80%' },
  nextPhotoZone: { position: 'absolute', right: 0, top: 0, width: '65%', height: '80%' },
  
  label: { 
    position: 'absolute', 
    top: 50, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderWidth: 4, 
    borderRadius: 8, 
    zIndex: 10 
  },
  likeLabel: { left: 40, borderColor: theme.teal, transform: [{ rotate: '-20deg' }] },
  nopeLabel: { right: 40, borderColor: theme.error, transform: [{ rotate: '20deg' }] },
  labelText: { fontSize: 32, fontWeight: '900', color: theme.textWhite, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },

  info: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
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
