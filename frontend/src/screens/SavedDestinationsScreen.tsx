import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, Dimensions, SafeAreaView,
  ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { userAPI } from '../api/services';
import { getLocalBucketList, removeFromLocalBucketList } from '../utils/bucketListUtils';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setSavedDestinations, removeSaved } from '../store/slices/savedSlice';
import { updateUser } from '../store/slices/authSlice';
import { useSavedSync } from '../hooks/useSavedSync';
import { useToast } from '../context/ToastContext';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SavedDestinationsScreen = () => {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { destinations: savedItems } = useSelector((state: RootState) => state.saved);
  useSavedSync(); // Activate global sync

  const handleRemove = async (id: string, mongoId?: string) => {
    try {
      const item = savedItems.find((d: any) => (d._id || d.id) === id || (d.title || d.name) === id);
      const title = item?.title || item?.name || id;

      dispatch(removeSaved(title));
      showToast('Removed', 'Destination removed from bucket list', 'info');

      if (isAuthenticated) {
        // Robust deletion: try both mongoId and title
        const res = await userAPI.deleteSavedDestination(mongoId || title);
        dispatch(updateUser({ savedDestinations: res.data.savedDestinations }));
      } else {
        await removeFromLocalBucketList(id);
      }
    } catch (error) {
       Alert.alert('Error', 'Failed to remove destination');
    }
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <Animated.View 
      entering={FadeInRight.delay(index * 100)}
      style={styles.card}
    >
      <View style={styles.cardInner}>
        <Image source={{ uri: item.image }} style={styles.image} />
        <View style={styles.content}>
          <Text style={[styles.name, { color: theme.text }]}>{item.title || item.name}</Text>
          <Text style={[styles.locationText, { color: theme.textSecondary }]}>📍 {typeof item.location === 'string' ? item.location : (item.address || 'India')}</Text>
          <Text style={[styles.cardDescription, { color: theme.textLight }]} numberOfLines={2}>
            {item.description || "Discover the magic of this destination..."}
          </Text>
          
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.viewBtn]}
              onPress={() => (navigation.navigate as any)('PlaceDetails', { place: item })}
            >
              <Text style={styles.viewBtnText}>View Details</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, styles.trashBtn]}
              onPress={() => handleRemove(item.id, item._id)}
            >
              <Ionicons name="trash-outline" size={18} color={theme.error} />
              <Text style={[styles.trashBtnText, { color: theme.error }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Saved Places</Text>
        <TouchableOpacity onPress={() => (navigation.navigate as any)('AllDestinations')} style={styles.backBtn}>
          <Ionicons name="compass-outline" size={30} color={theme.text} />
        </TouchableOpacity>
      </View>

        <FlatList
          data={savedItems}
          keyExtractor={(item, index) => item._id || item.id || item.title || `saved-${index}`}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-dislike-outline" size={60} color={theme.textLight} />
              <Text style={{ color: theme.textLight, marginTop: 16 }}>No saved destinations yet</Text>
              <TouchableOpacity 
                style={[styles.exploreBtn, { backgroundColor: COLORS.teal }]}
                onPress={() => (navigation.navigate as any)('AllDestinations')}
              >
                <Text style={styles.exploreBtnText}>Explore Now</Text>
              </TouchableOpacity>
            </View>
          }
        />
    </View>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
    flexGrow: 1,
  },
  card: {
    borderRadius: RADIUS.xl,
    backgroundColor: theme.card,
    marginBottom: 20,
    ...SHADOW.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardInner: {
    flexDirection: 'row',
    padding: 12,
  },
  image: {
    width: 110,
    height: 140,
    borderRadius: RADIUS.lg,
  },
  content: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewBtn: {
    backgroundColor: COLORS.teal,
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  trashBtn: {
    borderWidth: 1,
    borderColor: theme.error + '40',
  },
  trashBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    marginTop: 100,
  },
  exploreBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    ...SHADOW.md,
  },
  exploreBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default SavedDestinationsScreen;
