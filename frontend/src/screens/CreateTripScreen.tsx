import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Platform,
} from 'react-native';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { tripAPI } from '../api/services';

const MODES = [
  { key: 'flight', icon: '✈️', label: 'Flight' },
  { key: 'train', icon: '🚂', label: 'Train' },
  { key: 'car', icon: '🚗', label: 'Car' },
  { key: 'bus', icon: '🚌', label: 'Bus' },
  { key: 'bike', icon: '🏍️', label: 'Bike' },
  { key: 'other', icon: '🌍', label: 'Other' },
];

const BUDGETS = ['Budget', 'Mid-range', 'Luxury'];
const TRAVEL_TYPES = ['Solo', 'Group', 'Couples'];
const GENDER_PREFS = ['Any', 'Male', 'Female'];
const TAGS = [
  'Adventure', 'Food', 'Spiritual', 'Cultural', 'Nightlife',
  'Photography', 'Trekking', 'Beach', 'Road Trip', 'Backpacking',
  'Wildlife', 'Wellness', 'Historical', 'Camping',
];

export default function CreateTripScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [form, setForm] = useState({
    sourceCity: '', destCity: '',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    mode: 'other',
    budget: 'Budget',
    travelType: 'Group',
    tags: [] as string[],
    maxTravelers: '10',
    description: '',
    genderPreference: 'Any',
  });

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter(t => t !== tag)
        : f.tags.length < 5 ? [...f.tags, tag] : f.tags,
    }));
  };

  const handleSubmit = async () => {
    if (!form.sourceCity.trim() || !form.destCity.trim()) {
      Alert.alert('Missing Info', 'Please enter source and destination cities');
      return;
    }

    try {
      setSubmitting(true);
      await tripAPI.createTrip({
        source: { city: form.sourceCity.trim() },
        destination: { city: form.destCity.trim() },
        date: form.date.toISOString(),
        mode: form.mode,
        budget: form.budget,
        travelType: form.travelType,
        tags: form.tags,
        maxTravelers: parseInt(form.maxTravelers) || 10,
        description: form.description.trim(),
        genderPreference: form.genderPreference,
      });
      Alert.alert('🎉 Trip Created!', 'Your trip is now live for others to join.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to create trip');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Trip ✈️</Text>
        <View style={{ width: 32 }} />
      </LinearGradient>

      <KeyboardWrapper backgroundColor={COLORS.background} contentContainerStyle={styles.form}>
        {/* Route */}
        <Text style={styles.label}>📍 Route</Text>
        <View style={styles.routeRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="From (Delhi)"
            value={form.sourceCity}
            onChangeText={(t) => setForm(f => ({ ...f, sourceCity: t }))}
            placeholderTextColor={COLORS.textLight}
          />
          <Ionicons name="arrow-forward" size={20} color={COLORS.teal} style={{ marginHorizontal: 8 }} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="To (Goa)"
            value={form.destCity}
            onChangeText={(t) => setForm(f => ({ ...f, destCity: t }))}
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        {/* Date */}
        <Text style={styles.label}>📅 Travel Date</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={{ color: COLORS.text, fontSize: FONTS.md }}>
            {form.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={form.date}
            mode="date"
            minimumDate={new Date()}
            onChange={(e, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setForm(f => ({ ...f, date }));
            }}
          />
        )}

        {/* Mode */}
        <Text style={styles.label}>🚀 Travel Mode</Text>
        <View style={styles.chipRow}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.chip, form.mode === m.key && styles.chipActive]}
              onPress={() => setForm(f => ({ ...f, mode: m.key }))}
            >
              <Text style={styles.chipIcon}>{m.icon}</Text>
              <Text style={[styles.chipText, form.mode === m.key && styles.chipTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Budget */}
        <Text style={styles.label}>💸 Budget</Text>
        <View style={styles.chipRow}>
          {BUDGETS.map(b => (
            <TouchableOpacity
              key={b}
              style={[styles.chip, form.budget === b && styles.chipActive, { flex: 1 }]}
              onPress={() => setForm(f => ({ ...f, budget: b }))}
            >
              <Text style={[styles.chipText, form.budget === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Travel Type */}
        <Text style={styles.label}>🧳 Travel Type</Text>
        <View style={styles.chipRow}>
          {TRAVEL_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, form.travelType === t && styles.chipActive, { flex: 1 }]}
              onPress={() => setForm(f => ({ ...f, travelType: t }))}
            >
              <Text style={[styles.chipText, form.travelType === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gender Preference */}
        <Text style={styles.label}>👤 Gender Preference</Text>
        <View style={styles.chipRow}>
          {GENDER_PREFS.map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, form.genderPreference === g && styles.chipActive, { flex: 1 }]}
              onPress={() => setForm(f => ({ ...f, genderPreference: g }))}
            >
              <Text style={[styles.chipText, form.genderPreference === g && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Max Travelers */}
        <Text style={styles.label}>👥 Max Travelers</Text>
        <TextInput
          style={styles.input}
          placeholder="10"
          value={form.maxTravelers}
          onChangeText={(t) => setForm(f => ({ ...f, maxTravelers: t.replace(/[^0-9]/g, '') }))}
          keyboardType="number-pad"
          placeholderTextColor={COLORS.textLight}
        />

        {/* Tags */}
        <Text style={styles.label}>🏷️ Tags (up to 5)</Text>
        <View style={styles.chipRow}>
          {TAGS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, form.tags.includes(tag) && styles.chipActive]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[styles.chipText, form.tags.includes(tag) && styles.chipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.label}>📝 Description (optional)</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Tell travelers about your trip..."
          value={form.description}
          onChangeText={(t) => setForm(f => ({ ...f, description: t }))}
          multiline
          maxLength={500}
          placeholderTextColor={COLORS.textLight}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.submitGradient}>
            <Ionicons name="airplane" size={20} color="#fff" />
            <Text style={styles.submitText}>
              {submitting ? 'Creating...' : 'Create Trip'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </KeyboardWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '800', color: '#fff' },

  form: { padding: SPACING.md },
  label: {
    fontSize: FONTS.md, fontWeight: '700', color: COLORS.text,
    marginTop: 16, marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: FONTS.md, color: COLORS.text,
  },
  routeRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  chipActive: { borderColor: COLORS.teal, backgroundColor: COLORS.tealLight },
  chipIcon: { fontSize: 16 },
  chipText: { fontSize: FONTS.sm, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: COLORS.tealDark },

  submitBtn: { marginTop: 24, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.md },
  submitGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  submitText: { color: '#fff', fontSize: FONTS.lg, fontWeight: '800' },
});
