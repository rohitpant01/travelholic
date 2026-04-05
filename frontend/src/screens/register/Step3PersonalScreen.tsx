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
import KeyboardWrapper from '../../components/KeyboardWrapper';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { useAppTheme, FONTS, RADIUS, SPACING } from '../../utils/theme';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];
const PRONOUNS = ['He/Him', 'She/Her', 'They/Them', 'Any'];

export default function Step3PersonalScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
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
        gender, pronouns, bio,
        registrationStep: 5,
        profileComplete: false,
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
    <KeyboardWrapper 
      backgroundColor={theme.background} 
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <RegisterHeader step={4} totalSteps={8} title="Tell us about yourself" subtitle="Add your personal details" onBack={() => {
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
      <View style={styles.form}>

        <Text style={styles.label}>Date of Birth</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="calendar-outline" size={18} color={theme.textLight} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="DD/MM/YYYY"
            value={dob}
            onChangeText={formatDob}
            keyboardType="numeric"
            maxLength={10}
            placeholderTextColor={theme.textLight}
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
          placeholder="Tell travelers a bit about yourself..."
          value={bio}
          onChangeText={v => v.length <= 200 && setBio(v)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholderTextColor={theme.textLight}
        />
        <Text style={styles.charCount}>{bio.length}/200</Text>

        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={handleNext} disabled={loading}
        >
          <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.nextBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={theme.textWhite} /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.nextBtnText}>Continue</Text>
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
  form: { padding: SPACING.lg, paddingBottom: 40 },
  label: {
    fontSize: FONTS.xs, fontWeight: '700', color: theme.textSecondary,
    marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  optional: { fontWeight: '400', textTransform: 'none', fontSize: FONTS.xs, color: theme.textLight },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: theme.border,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: FONTS.base, color: theme.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card,
  },
  chipActive: { backgroundColor: theme.teal, borderColor: theme.teal },
  chipText: { fontSize: FONTS.sm, color: theme.textSecondary, fontWeight: '500' },
  chipTextActive: { color: theme.textWhite, fontWeight: '700' },
  bioInput: {
    backgroundColor: theme.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: theme.border,
    padding: 14, fontSize: FONTS.base, color: theme.text,
    minHeight: 110, lineHeight: 22,
  },
  charCount: { fontSize: FONTS.xs, color: theme.textLight, textAlign: 'right', marginTop: 4 },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 28 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: theme.textWhite, fontSize: FONTS.lg, fontWeight: '700' },
});
