import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterHeader from '../../components/RegisterHeader';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];
const PRONOUNS = ['He/Him', 'She/Her', 'They/Them', 'Any'];

export default function Step3PersonalScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [bio, setBio] = useState('');

  const handleNext = async () => {
    if (!dob || !gender) return Alert.alert('Error', 'Please fill date of birth and gender');

    // Validate date format DD/MM/YYYY
    const parts = dob.split('/');
    if (parts.length !== 3) return Alert.alert('Error', 'Date format: DD/MM/YYYY');
    const parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (isNaN(parsedDate.getTime())) return Alert.alert('Error', 'Invalid date');

    // Check age >= 18
    const today = new Date();
    const age = today.getFullYear() - parsedDate.getFullYear();
    if (age < 18) return Alert.alert('Error', 'You must be 18 or older to join');

    setLoading(true);
    try {
      const res = await userAPI.updateProfile({
        dob: parsedDate.toISOString(),
        gender, pronouns, bio, registrationStep: 4,
      });
      dispatch(updateUser(res.data.user));
      navigation.navigate('Register_Step4');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDob = (text: string) => {
    const nums = text.replace(/\D/g, '');
    let formatted = nums;
    if (nums.length > 2) formatted = nums.slice(0, 2) + '/' + nums.slice(2);
    if (nums.length > 4) formatted = nums.slice(0, 2) + '/' + nums.slice(2, 4) + '/' + nums.slice(4, 8);
    setDob(formatted);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RegisterHeader step={3} totalSteps={7} title="Personal Details"
        subtitle="Help others know you better" onBack={() => {
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
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Date of Birth</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.textLight} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="DD/MM/YYYY"
            value={dob}
            onChangeText={formatDob}
            keyboardType="numeric"
            maxLength={10}
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <Text style={styles.label}>Gender</Text>
        <View style={styles.chipRow}>
          {GENDERS.map(g => (
            <TouchableOpacity
              key={g} onPress={() => setGender(g)}
              style={[styles.chip, gender === g && styles.chipActive]}
            >
              <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Pronouns <Text style={styles.optional}>(Optional)</Text></Text>
        <View style={styles.chipRow}>
          {PRONOUNS.map(p => (
            <TouchableOpacity
              key={p} onPress={() => setPronouns(p === pronouns ? '' : p)}
              style={[styles.chip, pronouns === p && styles.chipActive]}
            >
              <Text style={[styles.chipText, pronouns === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={styles.bioInput}
          placeholder="Tell travelers a bit about yourself... your travel style, favourite trips, what you're looking for in a travel buddy ✈️"
          value={bio}
          onChangeText={v => v.length <= 200 && setBio(v)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholderTextColor={COLORS.textLight}
        />
        <Text style={styles.charCount}>{bio.length}/200</Text>

        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={handleNext} disabled={loading}
        >
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.nextBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={COLORS.white} /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: SPACING.lg, paddingBottom: 40 },
  label: {
    fontSize: FONTS.xs, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  optional: { fontWeight: '400', textTransform: 'none', fontSize: FONTS.xs, color: COLORS.textLight },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: FONTS.base, color: COLORS.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  chipText: { fontSize: FONTS.sm, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  bioInput: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 14, fontSize: FONTS.base, color: COLORS.text,
    minHeight: 110, lineHeight: 22,
  },
  charCount: { fontSize: FONTS.xs, color: COLORS.textLight, textAlign: 'right', marginTop: 4 },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 28 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
});
