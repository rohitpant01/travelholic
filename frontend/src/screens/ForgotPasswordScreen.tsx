// ============================================================
// ForgotPasswordScreen.tsx
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SPACING } from '../utils/theme';

export function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);

  const sendOTP = async () => {
    if (!email) return Alert.alert('Error', 'Enter your email address');
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setStep('otp');
      Alert.alert('OTP Sent', 'Check your email for the reset code');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const resetPassword = async () => {
    if (!otp || !newPassword) return Alert.alert('Error', 'Enter OTP and new password');
    if (newPassword.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters');
    setLoading(true);
    try {
      await authAPI.resetPassword(email, otp, newPassword);
      Alert.alert('Success', 'Password reset! Please login.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardWrapper 
      backgroundColor={COLORS.white} 
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <Text style={styles.headerSubtitle}>
          {step === 'email' ? "Enter your email to receive OTP" : "Enter OTP and new password"}
        </Text>
      </LinearGradient>

      <View style={styles.form}>
        {step === 'email' ? (
          <>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textLight} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                value={email} onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={sendOTP} disabled={loading}>
              <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.btnGrad}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Send OTP</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>OTP Code</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="keypad-outline" size={18} color={COLORS.textLight} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="6-digit OTP"
                value={otp} onChangeText={setOtp}
                keyboardType="numeric" maxLength={6}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                value={newPassword} onChangeText={setNewPassword}
                secureTextEntry
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={resetPassword} disabled={loading}>
              <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.btnGrad}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Reset Password</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardWrapper>
  );
}

// ============================================================
// EditProfileScreen.tsx - basic bio/interests edit
// ============================================================
export function EditProfileScreen() {
  const navigation = useNavigation<any>();
  return (
    <View style={editStyles.container}>
      <View style={editStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={editStyles.title}>Edit Profile</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={editStyles.body}>
        <Text style={editStyles.hint}>
          To edit your profile, complete the registration steps from Settings → Edit Profile.{'\n\n'}
          You can update bio, interests, languages, location, and photos.
        </Text>
        <Text style={editStyles.steps}>
          Available edits:{'\n'}
          • Bio & Personal Details{'\n'}
          • Travel Interests & Languages{'\n'}
          • Partner Preferences{'\n'}
          • Location & Distance{'\n'}
          • Photos
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// UserDetailScreen.tsx - view another user's profile
// ============================================================
export function UserDetailScreen() {
  const navigation = useNavigation<any>();
  return (
    <View style={editStyles.container}>
      <View style={editStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={editStyles.title}>Traveler Profile</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={editStyles.body}>
        <Text style={editStyles.hint}>Full profile view coming in next version.</Text>
      </View>
    </View>
  );
}

// Default export (ForgotPassword is primary export for this file as default)
export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  header: { paddingTop: 60, paddingBottom: 36, paddingHorizontal: 24 },
  backBtn: { marginBottom: 20 },
  headerTitle: { fontSize: FONTS.xxxl, fontWeight: '800', color: COLORS.white, marginBottom: 6 },
  headerSubtitle: { fontSize: FONTS.md, color: 'rgba(255,255,255,0.8)' },
  form: { flex: 1, padding: SPACING.lg },
  label: {
    fontSize: FONTS.xs, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 12,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: FONTS.base, color: COLORS.text },
  btn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 28 },
  btnGrad: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
});

const editStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text },
  body: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  hint: { fontSize: FONTS.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  steps: { fontSize: FONTS.base, color: COLORS.text, lineHeight: 28, alignSelf: 'flex-start' },
});
