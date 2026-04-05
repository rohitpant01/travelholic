import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue,
  interpolateColor
} from 'react-native-reanimated';
import { COLORS, FONTS, RADIUS, SPACING, SHADOW, useAppTheme } from '../utils/theme';

interface DiscoveryHeaderProps {
  viewMode: 'list' | 'map';
  onToggle: (mode: 'list' | 'map') => void;
  onFilterPress: () => void;
  onSavedPress: () => void;
  onNotificationsPress: () => void;
  unreadCount: number;
}

export default function DiscoveryHeader({
  viewMode,
  onToggle,
  onFilterPress,
  onSavedPress,
  onNotificationsPress,
  unreadCount
}: DiscoveryHeaderProps) {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  
  // Reanimated switch offset
  const switchTranslate = useSharedValue(viewMode === 'list' ? 2 : 80);

  useEffect(() => {
    switchTranslate.value = withSpring(viewMode === 'list' ? 2 : 80, { damping: 15 });
  }, [viewMode]);

  const animatedSwitchStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: switchTranslate.value }],
  }));

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.logoRow}>
          <Ionicons name="airplane" size={26} color={theme.teal} />
          <Text style={styles.logoText}>Discover</Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={onSavedPress}>
            <Ionicons name="heart-outline" size={24} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onNotificationsPress} style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onFilterPress}>
            <Ionicons name="options-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleContainer}>
          <Animated.View style={[styles.toggleActiveBg, animatedSwitchStyle]} />
          <TouchableOpacity 
            style={styles.toggleTab} 
            onPress={() => onToggle('list')}
            activeOpacity={1}
          >
            <Ionicons 
              name="list" 
              size={18} 
              color={viewMode === 'list' ? theme.textWhite : theme.textSecondary} 
            />
            <Text style={[
              styles.toggleText, 
              viewMode === 'list' && styles.toggleTextActive
            ]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.toggleTab} 
            onPress={() => onToggle('map')}
            activeOpacity={1}
          >
            <Ionicons 
              name="map" 
              size={18} 
              color={viewMode === 'map' ? theme.textWhite : theme.textSecondary} 
            />
            <Text style={[
              styles.toggleText, 
              viewMode === 'map' && styles.toggleTextActive
            ]}>Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  header: {
    backgroundColor: theme.background,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    zIndex: 100,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: 12,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { fontSize: 24, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationBtn: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.background,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  
  toggleRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    borderRadius: RADIUS.full,
    padding: 2,
    width: 160,
    height: 38,
    position: 'relative',
  },
  toggleActiveBg: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 78,
    height: 34,
    backgroundColor: theme.teal,
    borderRadius: RADIUS.full,
    ...SHADOW.sm,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  toggleTextActive: {
    color: theme.textWhite,
  },
});
