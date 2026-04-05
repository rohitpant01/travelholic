import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterHeader from '../../components/RegisterHeader';
import KeyboardWrapper from '../../components/KeyboardWrapper';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { useAppTheme, FONTS, RADIUS, SPACING } from '../../utils/theme';

const LOOKING_FOR = [
  { label: 'Travel Buddy', emoji: '👫', desc: 'Someone to explore with' },
  { label: 'Group Trip', emoji: '👥', desc: 'Join a group adventure' },
  { label: 'Adventure Partner', emoji: '🧗', desc: 'For extreme activities' },
  { label: 'Local Guide', emoji: '🗺️', desc: 'Know the place well' },
];

const GENDERS = ['Any', 'Male', 'Female', 'Non-binary'];
const BUDGETS = ['Budget', 'Mid-range', 'Luxury', 'Any'];
const DURATIONS = ['Weekend', '1-2 weeks', '1 month', 'Long-term', 'Any'];

export default function Step7PreferencesScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(false);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [preferredGender, setPreferredGender] = useState('Any');
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 45]);
  const [budget, setBudget] = useState('Any');
  const [tripDuration, setTripDuration] = useState('Any');

  const toggleLookingFor = (label: string) => {
    setLookingFor(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const handleFinish = async () => {
    if (lookingFor.length === 0) return Alert.alert('Error', 'Select what you\'re looking for');

    setLoading(true);
    try {
      const res = await userAPI.updateProfile({
        lookingFor,
        preferredGender,
        preferredAgeMin: ageRange[0],
        preferredAgeMax: ageRange[1],
        budget,
        tripDuration,
        registrationStep: 9,
        profileComplete: true,
      });
      dispatch(updateUser(res.data.user));
      navigation.navigate('Verification');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardWrapper 
      backgroundColor={theme.background} 
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <RegisterHeader step={8} totalSteps={8} title="Travel Preferences"
        subtitle="Find your perfect travel match" onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            Alert.alert('Exit', 'Do you want to exit registration?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: async () => {
                  await AsyncStorage.removeItem('token');
                  await AsyncStorage.removeItem('user');
                  dispatch(logout());
                } 
              }
            ]);
          }
        }} />
      <View style={styles.content}>

        <Text style={styles.sectionTitle}>I'm Looking For</Text>
        <View style={styles.lookingGrid}>
          {LOOKING_FOR.map(({ label, emoji, desc }) => {
            const selected = lookingFor.includes(label);
            return (
              <TouchableOpacity
                key={label}
                onPress={() => toggleLookingFor(label)}
                style={[styles.lookingCard, selected && styles.lookingCardActive]}
              >
                <Text style={styles.lookingEmoji}>{emoji}</Text>
                <Text style={[styles.lookingLabel, selected && styles.lookingLabelActive]}>{label}</Text>
                <Text style={[styles.lookingDesc, selected && styles.lookingDescActive]}>{desc}</Text>
                {selected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color={theme.textWhite} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Preferred Gender</Text>
        <View style={styles.chipRow}>
          {GENDERS.map(g => (
            <TouchableOpacity
              key={g} onPress={() => setPreferredGender(g)}
              style={[styles.chip, preferredGender === g && styles.chipActive]}
            >
              <Text style={[styles.chipText, preferredGender === g && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Preferred Age Range: {ageRange[0]}–{ageRange[1]} yrs
        </Text>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Min Age: {ageRange[0]}</Text>
          <Slider
            style={styles.slider}
            minimumValue={18} maximumValue={ageRange[1] - 1} step={1}
            value={ageRange[0]}
            onValueChange={v => setAgeRange([Math.round(v), ageRange[1]])}
            minimumTrackTintColor={theme.teal}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.teal}
          />
          <Text style={styles.sliderLabel}>Max Age: {ageRange[1]}</Text>
          <Slider
            style={styles.slider}
            minimumValue={ageRange[0] + 1} maximumValue={75} step={1}
            value={ageRange[1]}
            onValueChange={v => setAgeRange([ageRange[0], Math.round(v)])}
            minimumTrackTintColor={theme.teal}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.teal}
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Budget Preference</Text>
        <View style={styles.chipRow}>
          {BUDGETS.map(b => (
            <TouchableOpacity
              key={b} onPress={() => setBudget(b)}
              style={[styles.chip, budget === b && styles.chipActive]}
            >
              <Text style={[styles.chipText, budget === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Trip Duration</Text>
        <View style={styles.chipRow}>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d} onPress={() => setTripDuration(d)}
              style={[styles.chip, tripDuration === d && styles.chipActive]}
            >
              <Text style={[styles.chipText, tripDuration === d && styles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.finishBtn, loading && { opacity: 0.7 }]}
          onPress={handleFinish} disabled={loading}
        >
          <LinearGradient colors={[theme.orange, '#FF8C5A']} style={styles.finishBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={theme.textWhite} /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.finishBtnText}>Complete Profile 🎉</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardWrapper>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 48 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: theme.text, marginBottom: 12 },
  lookingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lookingCard: {
    width: '47%', padding: 14, borderRadius: RADIUS.lg,
    borderWidth: 2, borderColor: theme.border,
    backgroundColor: theme.card, alignItems: 'center',
    position: 'relative',
  },
  lookingCardActive: { borderColor: theme.teal, backgroundColor: theme.tealLight },
  lookingEmoji: { fontSize: 28, marginBottom: 6 },
  lookingLabel: { fontSize: FONTS.sm, fontWeight: '700', color: theme.text, textAlign: 'center' },
  lookingLabelActive: { color: theme.teal },
  lookingDesc: { fontSize: FONTS.xs, color: theme.textLight, textAlign: 'center', marginTop: 2 },
  lookingDescActive: { color: theme.teal },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: theme.teal, alignItems: 'center', justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card,
  },
  chipActive: { backgroundColor: theme.teal, borderColor: theme.teal },
  chipText: { fontSize: FONTS.sm, color: theme.textSecondary },
  chipTextActive: { color: theme.textWhite, fontWeight: '700' },
  sliderContainer: { gap: 4 },
  sliderLabel: { fontSize: FONTS.sm, color: theme.textSecondary },
  slider: { width: '100%', height: 40 },
  finishBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 32 },
  finishBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  finishBtnText: { color: theme.textWhite, fontSize: FONTS.lg, fontWeight: '800', letterSpacing: 0.3 },
});
