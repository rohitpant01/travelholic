import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// Removed expo-blur due to dependency conflicts, using styled View fallback
import { COLORS, SHADOW } from '../utils/theme';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 20;
const CARD_WIDTH = width - (CARD_MARGIN * 2) - 70; // 70 for the time labels column

interface PlannerCardProps {
  item: any;
  index: number;
  isSaved: boolean;
  onToggleFavorite: (item: any) => void;
  onNavigate: (item: any) => void;
}

const PlannerCard: React.FC<PlannerCardProps> = ({
  item,
  index,
  isSaved,
  onToggleFavorite,
  onNavigate,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const handleFlip = () => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  const photoUrl = item.photoReference
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${item.photoReference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
    : 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80';

  return (
    <View style={styles.container}>
      {/* FRONT SIDE */}
      <Animated.View
        style={[
          styles.card,
          { transform: [{ rotateY: frontInterpolate }], opacity: frontOpacity },
        ]}
      >
        <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={styles.full}>
          <Image source={{ uri: photoUrl }} style={styles.cardImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.cardOverlay}
          >
            <View style={styles.cardHeader}>
              <View style={styles.badgeContainer}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                  <Text style={styles.badgeText}>{item.rating}</Text>
                </View>
                <View style={[styles.ratingBadge, { marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={styles.badgeTextSmall}>{item.distance}</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.placeName}>{item.placeName}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* BACK SIDE */}
      <Animated.View
        style={[
          styles.card,
          styles.cardBack,
          { transform: [{ rotateY: backInterpolate }], opacity: backOpacity },
        ]}
      >
        <View style={styles.backContainer}>
          <Pressable onPress={handleFlip} style={styles.backContent}>
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
              nestedScrollEnabled={true}
            >
              <View style={styles.backHeader}>
                <Text style={styles.backTitle}>{item.placeName}</Text>
                <View style={styles.tagRow}>
                  {item.tags?.map((tag: string, i: number) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => setIsExpanded(!isExpanded)} 
                style={styles.descriptionContainer}
              >
                <Text style={styles.description} numberOfLines={isExpanded ? undefined : 3}>
                  {item.secretStory}
                </Text>
                {item.secretStory?.length > 100 && (
                  <Text style={styles.readMoreText}>
                    {isExpanded ? 'Show Less' : 'Read More...'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.infoGrid}>
                <View style={styles.infoChip}>
                  <Ionicons name="time-outline" size={16} color="#00B4B4" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Best Time</Text>
                    <Text style={styles.infoValue}>{item.info?.bestTime && item.info.bestTime !== 'Morning' ? item.info.bestTime : 'Oct – Mar'}</Text>
                  </View>
                </View>
                <View style={styles.infoChip}>
                  <Ionicons name="cash-outline" size={16} color="#00B4B4" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Entry Fee</Text>
                    <Text style={styles.infoValue}>{item.info?.fee || 'Free'}</Text>
                  </View>
                </View>
                <View style={styles.infoChip}>
                  <Ionicons name="fitness-outline" size={16} color="#00B4B4" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Difficulty</Text>
                    <Text style={styles.infoValue}>{item.info?.difficulty || 'Easy'}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.backActions}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => onNavigate(item)}
              >
                <Ionicons name="navigate" size={18} color={COLORS.white} />
                <Text style={styles.btnPrimaryText}>Go</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => onToggleFavorite(item)}
              >
                <Ionicons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={18}
                  color="#00B4B4"
                />
                <Text style={styles.btnSecondaryText}>{isSaved ? 'Saved' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 340,
  },
  full: {
    flex: 1,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    ...SHADOW.md,
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 180, 180, 0.2)',
  },
  backContainer: {
    flex: 1,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'space-between',
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  badgeTextSmall: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  favoriteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFooter: {
    marginTop: 'auto',
  },
  placeName: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  backContent: {
    flex: 1,
    padding: 18,
  },
  backHeader: {
    marginBottom: 12,
  },
  backTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: 'rgba(0,180,180,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    color: '#00B4B4',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  descriptionContainer: {
    marginBottom: 15,
  },
  description: {
    fontSize: 14,
    color: '#5A6878',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  readMoreText: {
    color: '#00B4B4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTextContainer: {
    marginLeft: 6,
  },
  infoLabel: {
    fontSize: 9,
    color: '#9BA8B5',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 11,
    color: '#1A1A2E',
    fontWeight: '700',
  },
  backActions: {
    flexDirection: 'row',
    marginTop: 'auto',
    gap: 12,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00B4B4',
    paddingVertical: 12,
    borderRadius: 12,
    ...SHADOW.sm,
  },
  btnPrimaryText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00B4B4',
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnSecondaryText: {
    color: '#00B4B4',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
});

export default PlannerCard;
