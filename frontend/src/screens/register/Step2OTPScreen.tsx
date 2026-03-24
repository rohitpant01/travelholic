import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Keyboard
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterHeader from '../../components/RegisterHeader';
import { authAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';

export default function Step2OTPScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch();
  
  const { phone: initialPhone, userId } = route.params || {};
  const isGooglePhone = initialPhone?.startsWith('google_');
  
  const [phone, setPhone] = useState(isGooglePhone ? '' : initialPhone);
  const [isPhoneEntered, setIsPhoneEntered] = useState(!isGooglePhone);
  const [sendingOTP, setSendingOTP] = useState(false);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(isGooglePhone ? 0 : 60);
  const inputs = useRef<TextInput[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSendInitialOTP = async () => {
    if (phone.length < 10) return Alert.alert('Error', 'Please enter a valid 10-digit number');
    let finalPhone = phone.trim();
    if (/^\d{10}$/.test(finalPhone)) finalPhone = `+91${finalPhone}`;
    
    setSendingOTP(true);
    try {
      await authAPI.sendOTP(finalPhone, true);
      setPhone(finalPhone);
      setIsPhoneEntered(true);
      setResendTimer(60);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSendingOTP(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (!text && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return Alert.alert('Error', 'Please enter complete 6-digit OTP');

    setLoading(true);
    try {
      console.log(`[OTP] Attempting verification for ${phone}, code: ${code}`);
      await authAPI.verifyOTP(phone, code, userId);
      console.log('[OTP] Verification success. Navigating to Step 3.');
      
      // Update the user's phone in Redux state alongside the verified status
      dispatch(updateUser({ phone: phone, isPhoneVerified: true, registrationStep: 4 }));
      navigation.navigate('Register_Step3');
    } catch (error: any) {
      console.error('[OTP] Verification error:', error.response?.data || error.message);
      Alert.alert('Verification Failed', error.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await authAPI.sendOTP(phone);
      setResendTimer(60);
      setOtp(['', '', '', '', '', '']);
      Alert.alert('OTP Sent', 'A new OTP has been sent to your phone');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to resend OTP');
    }
  };

  if (!isPhoneEntered) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.white }}>
        <RegisterHeader
          step={3} totalSteps={8}
          title="Add Phone Number" subtitle="We need this to verify your account"
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
        <View style={styles.content}>
          <Text style={styles.label}>Mobile Number *</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.countryCode}>+91</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit number"
              value={phone.replace('+91', '')}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, { marginTop: 40 }, sendingOTP && { opacity: 0.7 }]}
            onPress={handleSendInitialOTP}
            disabled={sendingOTP}
          >
            <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.verifyBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {sendingOTP ? <ActivityIndicator color={COLORS.white} /> : (
                <Text style={styles.verifyBtnText}>Send OTP</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <RegisterHeader
        step={3} totalSteps={8}
        title="Verify Phone" subtitle={`Enter the OTP sent to ${phone}`}
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
      <View style={styles.content}>
        <View style={styles.phoneCard}>
          <Text style={styles.phoneEmoji}>📱</Text>
          <Text style={styles.phoneTitle}>Check your messages</Text>
          <Text style={styles.phoneText}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneNumber}>{phone}</Text>
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
              selectionColor={COLORS.teal}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={loading}
        >
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.verifyBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={COLORS.white} /> : (
              <Text style={styles.verifyBtnText}>Verify OTP ✓</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive the code?</Text>
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
            <Text style={[styles.resendBtn, resendTimer > 0 && styles.resendDisabled]}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: SPACING.lg },
  phoneCard: {
    backgroundColor: COLORS.tealLight, borderRadius: 20,
    padding: 24, alignItems: 'center', marginBottom: 32,
  },
  phoneEmoji: { fontSize: 40, marginBottom: 12 },
  phoneTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.teal, marginBottom: 8 },
  phoneText: { fontSize: FONTS.md, color: COLORS.textSecondary, textAlign: 'center' },
  phoneNumber: { fontWeight: '700', color: COLORS.text },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  otpInput: {
    width: 50, height: 58, borderRadius: 14,
    borderWidth: 2, borderColor: COLORS.border,
    fontSize: FONTS.xxl, fontWeight: '700', color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  otpInputFilled: { borderColor: COLORS.teal, backgroundColor: COLORS.tealLight },
  verifyBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 20 },
  verifyBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  verifyBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
  resendRow: { alignItems: 'center', gap: 6 },
  resendLabel: { fontSize: FONTS.sm, color: COLORS.textSecondary },
  resendBtn: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.teal },
  resendDisabled: { color: COLORS.textLight },
  label: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12 },
  countryCode: { fontSize: FONTS.md, color: COLORS.text, fontWeight: '600' },
  divider: { width: 1, height: 24, backgroundColor: COLORS.border, marginHorizontal: 12 },
  input: { flex: 1, fontSize: FONTS.base, color: COLORS.text },
});
