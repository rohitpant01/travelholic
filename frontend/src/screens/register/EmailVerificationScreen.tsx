import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Keyboard, Image
} from 'react-native';
import KeyboardWrapper from '../../components/KeyboardWrapper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterHeader from '../../components/RegisterHeader';
import { authAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import { useAppTheme, FONTS, RADIUS, SPACING } from '../../utils/theme';

export default function EmailVerificationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  
  const { email, userId } = route.params || {};
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputs = useRef<TextInput[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (!text && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return Alert.alert('Error', 'Please enter complete 6-digit code');

    setLoading(true);
    try {
      console.log(`[EMAIL VERIFY] Attempting verification for ${email}, code: ${code}`);
      const res = await authAPI.verifyEmailOTP(email, code, userId);
      
      console.log('[EMAIL VERIFY] Success! Advancing to onboarding.');
      
      // Update local state — phone OTP is disabled, go straight to step 4
      dispatch(updateUser({ isEmailVerified: true, isPhoneVerified: true, registrationStep: 4 }));
      
      console.log('[EMAIL VERIFY] Success! Root Navigator will handle redirection to Personal Details.');
    } catch (error: any) {
      console.error('[EMAIL VERIFY] Error:', error.response?.data || error.message);
      Alert.alert('Verification Failed', error.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await authAPI.sendEmailOTP(email, userId);
      setResendTimer(60);
      setOtp(['', '', '', '', '', '']);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to resend code');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <RegisterHeader
        step={2} totalSteps={8}
        title="Verify Email" subtitle="Enter the code sent to your email"
        onBack={() => {
          Alert.alert('Exit Registration', 'Do you want to log out and exit? You can resume later.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Exit & Logout', style: 'destructive', onPress: async () => {
                await AsyncStorage.removeItem('token');
                await AsyncStorage.removeItem('user');
                dispatch(logout());
              } 
            }
          ]);
        }}
      />
      
      <KeyboardWrapper backgroundColor={theme.background} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📧</Text>
          <Text style={styles.title}>Check your Inbox</Text>
          <Text style={styles.text}>
            We've sent a 6-digit verification code to{'\n'}
            <Text style={styles.emailText}>{email || 'your email'}</Text>
          </Text>
        </View>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={el => { if (el) inputs.current[i] = el; }}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
              value={digit}
              onChangeText={text => handleOtpChange(text.replace(/\D/g, ''), i)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              selectionColor={theme.teal}
              placeholderTextColor={theme.textLight}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={loading}
        >
          <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.verifyBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={theme.textWhite} /> : (
              <Text style={styles.verifyBtnText}>Verify Email ✓</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive the email?</Text>
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
            <Text style={[styles.resendBtn, resendTimer > 0 && styles.resendDisabled]}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.tip}>Tip: Please check your Spam or Promotions folder if you don't see it in your primary inbox.</Text>
      </KeyboardWrapper>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  content: { flex: 1, padding: SPACING.lg },
  card: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(0, 128, 128, 0.1)' : '#F0F9FF', borderRadius: 20,
    padding: 24, alignItems: 'center', marginBottom: 32,
    borderWidth: 1, borderColor: theme.mode === 'dark' ? theme.teal + '40' : '#BAE6FD',
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: FONTS.lg, fontWeight: '700', color: theme.mode === 'dark' ? theme.teal : '#0369A1', marginBottom: 8 },
  text: { fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  emailText: { fontWeight: '700', color: theme.text },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  otpInput: {
    width: 48, height: 56, borderRadius: 12,
    borderWidth: 2, borderColor: theme.border,
    fontSize: FONTS.xl, fontWeight: '700', color: theme.text,
    backgroundColor: theme.card,
  },
  otpInputFilled: { borderColor: theme.teal, backgroundColor: theme.tealLight },
  verifyBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 20 },
  verifyBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  verifyBtnText: { color: theme.textWhite, fontSize: FONTS.lg, fontWeight: '700' },
  resendRow: { alignItems: 'center', gap: 6 },
  resendLabel: { fontSize: FONTS.sm, color: theme.textSecondary },
  resendBtn: { fontSize: FONTS.sm, fontWeight: '700', color: theme.teal },
  resendDisabled: { color: theme.textLight },
  tip: {
    marginTop: 40, textAlign: 'center', fontSize: 12, color: theme.textLight,
    paddingHorizontal: 20, lineHeight: 18
  }
});
