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

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DiscoveryHeaderProps {
  onSavedPress: () => void;
  onNotificationsPress: () => void;
  unreadCount: number;
  onFilterPress?: () => void;
  viewMode?: 'swipe' | 'list';
  onToggleView?: () => void;
  onProfilePress?: () => void;
  userAvatar?: string;
}

export default function DiscoveryHeader({
  onSavedPress,
  onNotificationsPress,
  unreadCount,
  onFilterPress,
  viewMode,
  onToggleView,
  onProfilePress,
  userAvatar
}: DiscoveryHeaderProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  
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
          {onToggleView && (
            <TouchableOpacity onPress={onToggleView}>
              <Ionicons name={viewMode === 'list' ? 'apps' : 'list'} size={24} color={theme.text} />
            </TouchableOpacity>
          )}
          {onFilterPress && (
            <TouchableOpacity onPress={onFilterPress}>
              <Ionicons name="options-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

    </View>
  );
}

const getStyles = (theme: any, insets: any) => StyleSheet.create({
  header: {
    backgroundColor: theme.background,
    paddingTop: Math.max(insets.top, 16),
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
});
