import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { RootState } from '../store';
import { userAPI } from '../api/services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, RADIUS, SPACING } from '../utils/theme';
import { logout, updateUser } from '../store/slices/authSlice';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { user } = useSelector((s: RootState) => s.auth);
  const [distance, setDistance] = useState(user?.maxDiscoveryDistance || 50);
  const [saving, setSaving] = useState(false);

  const DISTANCE_PRESETS = [20, 30, 50, 75, 100];

  const handleSaveDistance = async () => {
    setSaving(true);
    try {
      await userAPI.updateDistance(distance);
      dispatch(updateUser({ maxDiscoveryDistance: distance }));
      Alert.alert('Saved', `Discovery distance set to ${distance} km`);
    } catch (e) {
      Alert.alert('Error', 'Could not save distance');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              dispatch(logout());
              navigation.reset({
                index: 0,
                routes: [{ name: 'Landing' }],
              });
            } catch (e) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const settingsItems = [
    {
      icon: 'person-outline', label: 'Edit Profile',
      onPress: () => navigation.navigate('EditProfile'), color: COLORS.teal,
    },
    {
      icon: 'notifications-outline', label: 'Notifications',
      onPress: () => Alert.alert('Coming soon'), color: COLORS.orange,
    },
    {
      icon: 'shield-checkmark-outline', label: 'Privacy & Safety',
      onPress: () => Alert.alert('Coming soon'), color: COLORS.gold,
    },
    {
      icon: 'help-circle-outline', label: 'Help & Support',
      onPress: () => Alert.alert('Coming soon'), color: COLORS.info,
    },
    {
      icon: 'information-circle-outline', label: 'About TravelHolic',
      onPress: () => Alert.alert('TravelHolic v1.0.0', 'Find your travel soulmate ✈️'), color: COLORS.textSecondary,
    },
    {
      icon: 'log-out-outline', label: 'Logout',
      onPress: handleLogout, color: COLORS.error,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Discovery Distance */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrapper}>
            <Ionicons name="location" size={20} color={COLORS.white} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Discovery Distance</Text>
            <Text style={styles.cardSubtitle}>
              Find travelers within a certain radius
            </Text>
          </View>
        </View>

        <View style={styles.distanceDisplay}>
          <Text style={styles.distanceNumber}>{distance}</Text>
          <Text style={styles.distanceUnit}>km</Text>
        </View>

        {/* ================================================================
          GOOGLE MAPS API KEY used for geocoding in location screens.
          The distance filter here is purely backend-side using MongoDB
          $geoNear with maxDistance set to (distance * 1000) meters.
          No additional Google Maps key needed for this slider.
         ================================================================ */}
        <Slider
          style={styles.slider}
          minimumValue={10}
          maximumValue={100}
          step={5}
          value={distance}
          onValueChange={v => setDistance(Math.round(v))}
          minimumTrackTintColor={COLORS.teal}
          maximumTrackTintColor={COLORS.border}
          thumbTintColor={COLORS.teal}
        />

        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>10 km</Text>
          <Text style={styles.sliderLabelText}>100 km</Text>
        </View>

        {/* Preset buttons */}
        <View style={styles.presets}>
          {DISTANCE_PRESETS.map(preset => (
            <TouchableOpacity
              key={preset}
              onPress={() => setDistance(preset)}
              style={[styles.preset, distance === preset && styles.presetActive]}
            >
              <Text style={[styles.presetText, distance === preset && styles.presetTextActive]}>
                {preset} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSaveDistance} disabled={saving}
        >
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.saveBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {saving ? <ActivityIndicator color={COLORS.white} size="small" /> : (
              <Text style={styles.saveBtnText}>Save Distance</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Settings list */}
      <View style={styles.settingsList}>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.settingsItem,
              index < settingsItems.length - 1 && styles.settingsItemBorder,
            ]}
            onPress={item.onPress}
          >
            <View style={[styles.settingsIcon, { backgroundColor: item.color + '18' }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <Text style={styles.settingsLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.versionText}>TravelHolic v1.0.0 · Made with ✈️ & ❤️</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text },
  card: {
    backgroundColor: COLORS.white, borderRadius: 20, margin: 16,
    padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cardIconWrapper: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  cardSubtitle: { fontSize: FONTS.sm, color: COLORS.textSecondary, marginTop: 2 },
  distanceDisplay: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    marginBottom: 4, gap: 4,
  },
  distanceNumber: { fontSize: 52, fontWeight: '900', color: COLORS.teal },
  distanceUnit: { fontSize: FONTS.xl, color: COLORS.textSecondary, fontWeight: '600' },
  slider: { width: '100%', height: 40 },
  sliderLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 16,
  },
  sliderLabelText: { fontSize: FONTS.xs, color: COLORS.textLight },
  presets: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  preset: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  presetActive: { backgroundColor: COLORS.tealLight, borderColor: COLORS.teal },
  presetText: { fontSize: FONTS.sm, color: COLORS.textSecondary },
  presetTextActive: { color: COLORS.teal, fontWeight: '700' },
  saveBtn: { borderRadius: RADIUS.full, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.base },
  settingsList: {
    backgroundColor: COLORS.white, borderRadius: 20,
    marginHorizontal: 16, marginBottom: 16, overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  settingsItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  settingsIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  settingsLabel: { flex: 1, fontSize: FONTS.base, color: COLORS.text, fontWeight: '500' },
  versionText: {
    textAlign: 'center', fontSize: FONTS.xs, color: COLORS.textLight,
    marginBottom: 32, marginTop: 8,
  },
});
