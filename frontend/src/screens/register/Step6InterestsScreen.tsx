import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Platform
} from 'react-native';
import KeyboardWrapper from '../../components/KeyboardWrapper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterHeader from '../../components/RegisterHeader';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { useAppTheme, FONTS, RADIUS, SPACING } from '../../utils/theme';

const INTERESTS = [
  { label: 'Mountains', emoji: '🏔️' },
  { label: 'Beaches', emoji: '🏖️' },
  { label: 'Road Trips', emoji: '🚗' },
  { label: 'Trekking', emoji: '🥾' },
  { label: 'Camping', emoji: '⛺' },
  { label: 'Photography', emoji: '📸' },
  { label: 'Food Travel', emoji: '🍜' },
  { label: 'Cultural Travel', emoji: '🏛️' },
  { label: 'Adventure Sports', emoji: '🪂' },
  { label: 'Backpacking', emoji: '🎒' },
  { label: 'Solo Travel', emoji: '🧍' },
  { label: 'Cruises', emoji: '🚢' },
  { label: 'City Tours', emoji: '🏙️' },
  { label: 'History & Museums', emoji: '🏛️' },
  { label: 'Nightlife', emoji: '🌃' },
  { label: 'Wellness & Yoga', emoji: '🧘' },
  { label: 'Wildlife Safari', emoji: '🦁' },
];

const COMMON_LANGUAGES = [
  'English', 'Hindi', 'Spanish', 'French', 'German',
  'Arabic', 'Portuguese', 'Japanese', 'Korean', 'Mandarin',
  'Italian', 'Russian', 'Tamil', 'Bengali', 'Urdu',
];

export default function Step6InterestsScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState('');

  const toggleInterest = (label: string) => {
    setSelectedInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const addCustomLanguage = () => {
    const trimmed = customLanguage.trim();
    if (trimmed && !selectedLanguages.includes(trimmed)) {
      setSelectedLanguages(prev => [...prev, trimmed]);
      setCustomLanguage('');
    }
  };

  const handleNext = async () => {
    if (selectedInterests.length < 1) return Alert.alert('Error', 'Please select at least 1 travel interest');
    if (selectedLanguages.length < 1) return Alert.alert('Error', 'Please select at least 1 language');

    setLoading(true);
    try {
      // Update user profile with interests, languages, and advance registration step
      await userAPI.updateProfile({
        interests: selectedInterests,
        languages: selectedLanguages,
        registrationStep: 8, // Changed from 7 to 8
      });
      // Dispatch update to Redux store
      dispatch(updateUser({
        interests: selectedInterests,
        languages: selectedLanguages,
        registrationStep: 8, // Changed from 7 to 8
      }));
      navigation.navigate('Register_Step7');
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
      <RegisterHeader step={7} totalSteps={8} title="Travel Interests"
        subtitle="What kind of traveler are you?" onBack={() => {
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

        <Text style={styles.sectionTitle}>Travel Interests</Text>
        <Text style={styles.sectionHint}>Select all that apply</Text>
        <View style={styles.chipGrid}>
          {INTERESTS.map(({ label, emoji }) => {
            const selected = selectedInterests.includes(label);
            return (
              <TouchableOpacity
                key={label}
                onPress={() => toggleInterest(label)}
                style={[styles.interestChip, selected && styles.interestChipActive]}
              >
                <Text style={styles.interestEmoji}>{emoji}</Text>
                <Text style={[styles.interestLabel, selected && styles.interestLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Languages Spoken</Text>
        <Text style={styles.sectionHint}>Select languages you speak</Text>
        <View style={styles.chipRow}>
          {COMMON_LANGUAGES.map(lang => {
            const selected = selectedLanguages.includes(lang);
            return (
              <TouchableOpacity
                key={lang}
                onPress={() => toggleLanguage(lang)}
                style={[styles.langChip, selected && styles.langChipActive]}
              >
                <Text style={[styles.langLabel, selected && styles.langLabelActive]}>{lang}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.customLangRow}>
          <TextInput
            style={styles.customLangInput}
            placeholder="Add another language..."
            value={customLanguage}
            onChangeText={setCustomLanguage}
            onSubmitEditing={addCustomLanguage}
            placeholderTextColor={theme.textLight}
          />
          <TouchableOpacity style={styles.addLangBtn} onPress={addCustomLanguage}>
            <Ionicons name="add" size={22} color={theme.textWhite} />
          </TouchableOpacity>
        </View>

        {selectedLanguages.length > 0 && (
          <View style={styles.selectedLangs}>
            <Text style={styles.selectedLangsLabel}>Selected: </Text>
            <Text style={styles.selectedLangsText}>{selectedLanguages.join(', ')}</Text>
          </View>
        )}

        <Text style={styles.counter}>
          {selectedInterests.length} interests · {selectedLanguages.length} languages
        </Text>

        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={handleNext} disabled={loading}
        >
          <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.nextBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={theme.textWhite} /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.nextBtnText}>Almost Done!</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.textWhite} />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardWrapper>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 40 },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: '700', color: theme.text, marginBottom: 4 },
  sectionHint: { fontSize: FONTS.sm, color: theme.textLight, marginBottom: 14 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card,
  },
  interestChipActive: { backgroundColor: theme.tealLight, borderColor: theme.teal },
  interestEmoji: { fontSize: 16 },
  interestLabel: { fontSize: FONTS.sm, color: theme.textSecondary, fontWeight: '500' },
  interestLabelActive: { color: theme.teal, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card,
  },
  langChipActive: { backgroundColor: theme.teal, borderColor: theme.teal },
  langLabel: { fontSize: FONTS.sm, color: theme.textSecondary },
  langLabelActive: { color: theme.textWhite, fontWeight: '700' },
  customLangRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  customLangInput: {
    flex: 1, backgroundColor: theme.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: FONTS.base, color: theme.text,
  },
  addLangBtn: {
    backgroundColor: theme.teal, borderRadius: RADIUS.md,
    width: 44, alignItems: 'center', justifyContent: 'center',
  },
  selectedLangs: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 8,
    backgroundColor: theme.tealLight, borderRadius: RADIUS.md, padding: 10,
  },
  selectedLangsLabel: { fontSize: FONTS.sm, fontWeight: '700', color: theme.teal },
  selectedLangsText: { fontSize: FONTS.sm, color: theme.teal },
  counter: {
    textAlign: 'center', fontSize: FONTS.sm, color: theme.textLight,
    marginVertical: 16,
  },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden' },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: theme.textWhite, fontSize: FONTS.lg, fontWeight: '700' },
});
