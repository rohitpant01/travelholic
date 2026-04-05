import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';

const { width } = Dimensions.get('window');

interface TravelerPreviewSheetProps {
  user: any | null;
  onClose: () => void;
  onViewProfile: (user: any) => void;
}

export default function TravelerPreviewSheet({ user, onClose, onViewProfile }: TravelerPreviewSheetProps) {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  
  // Ref for the bottom sheet
  const bottomSheetRef = React.useRef<BottomSheet>(null);

  // Points where the bottom sheet can rest
  const snapPoints = useMemo(() => ['30%'], []);

  // Handle changes
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  // Backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.3}
      />
    ),
    []
  );

  if (!user) return null;

  const profilePhoto = user.photos?.find((p: any) => p.isProfile)?.url || user.photos?.[0]?.url;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.card }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.header}>
          <Image 
            source={{ uri: profilePhoto || 'https://via.placeholder.com/150' }} 
            style={styles.avatar} 
          />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.firstName}{user.age ? `, ${user.age}` : ''}</Text>
              {user.isPhotoVerified && (
                <Ionicons name="checkmark-circle" size={16} color={theme.teal} />
              )}
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={theme.textSecondary} />
              <Text style={styles.location}>
                {user.location?.city || user.city || 'Nearby'} · {user.distanceKm?.toFixed(1) || '0.5'} km away
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.bio} numberOfLines={2}>
          {user.bio || "Exploring new horizons and meeting amazing travelers! 🌍"}
        </Text>

        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => onViewProfile(user)}
        >
          <Text style={styles.actionBtnText}>View Full Profile</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.textWhite} />
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  content: {
    padding: 20,
    backgroundColor: theme.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.border,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  bio: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: theme.teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    ...SHADOW.md,
  },
  actionBtnText: {
    color: theme.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});
