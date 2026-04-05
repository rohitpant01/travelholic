import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import KeyboardWrapper from '../../components/KeyboardWrapper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RegisterHeader from '../../components/RegisterHeader';
import { authAPI } from '../../api/services';
import { setUser, setToken } from '../../store/slices/authSlice';
import { useAppTheme, FONTS, RADIUS, SPACING } from '../../utils/theme';
import apiClient from '../../api/client';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import CountryCodePicker from '../../components/CountryCodePicker';
import { COUNTRIES, CountryData } from '../../data/countries';

export default function Step1AccountScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState<CountryData>(COUNTRIES[0]); // Default India +91

  const googleProfile = route.params?.googleProfile;

  const [form, setForm] = useState({
    firstName: googleProfile?.firstName || '', 
    lastName: googleProfile?.lastName || '', 
    username: '',
    email: googleProfile?.email || '', 
    phone: '', 
    password: '', 
    confirmPassword: '',
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleNext = async () => {
    const { firstName, lastName, username, email, phone, password, confirmPassword } = form;
    if (!firstName || !lastName || !username || !email || !phone || !password) {
      return Alert.alert('Error', 'Please fill in all fields');
    }
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters');
    if (password !== confirmPassword) return Alert.alert('Error', 'Passwords do not match');
    // Auto-prepend country code
    const fullPhone = phone.startsWith('+') ? phone : `${countryCode.dial}${phone}`;

    setLoading(true);
    try {
      console.log('[REG] Attempting registration for:', email);
      const res = await authAPI.register({ 
        firstName, lastName, username, email, phone: fullPhone, password,
        googleId: googleProfile?.googleId,
        picture: googleProfile?.picture,
        authProvider: googleProfile ? 'google' : 'local'
      });
      const { token, user } = res.data;
      console.log('[REG] Registration success. User ID:', user._id);
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      dispatch(setToken(token));
      dispatch(setUser(user));
      
      console.log('[REG] Registration successful. Root Navigator will handle redirection.');
    } catch (error: any) {
      console.error('[REG] Registration error:', error.response?.data || error.message);
      Alert.alert('Registration Failed', error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };


  const fields = [
    { key: 'firstName', label: 'First Name', icon: 'person-outline', placeholder: 'John' },
    { key: 'lastName', label: 'Last Name', icon: 'person-outline', placeholder: 'Doe' },
    { key: 'username', label: 'Username', icon: 'at-outline', placeholder: 'johntravels', lower: true },
    { key: 'email', label: 'Email Address', icon: 'mail-outline', placeholder: 'john@email.com', email: true },
  ];

  return (
    <KeyboardWrapper 
      backgroundColor={theme.background} 
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <RegisterHeader step={1} totalSteps={8} title="Create Account" subtitle="Tell us about yourself" />
      <View style={styles.form}>

        {fields.map(f => {
          const isEmailLocked = googleProfile && f.key === 'email';
          return (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={[styles.inputWrapper, isEmailLocked && styles.inputDisabled]}>
                <Ionicons name={f.icon as any} size={18} color={theme.textLight} style={styles.icon} />
                <TextInput
                  style={[styles.input, isEmailLocked && { color: theme.textLight }]}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChangeText={v => update(f.key, f.lower ? v.toLowerCase() : v)}
                  autoCapitalize={f.lower || f.email ? 'none' : 'words'}
                  keyboardType={f.email ? 'email-address' : f.phone ? 'phone-pad' : 'default'}
                  placeholderTextColor={theme.textLight}
                  editable={!isEmailLocked}
                />
                {isEmailLocked && (
                  <Ionicons name="lock-closed" size={14} color={theme.textLight} />
                )}
              </View>
            </View>
          );
        })}

        {/* Phone Number with Country Code Picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CountryCodePicker selected={countryCode} onSelect={setCountryCode} />
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                value={form.phone}
                onChangeText={v => update('phone', v)}
                keyboardType="phone-pad"
                maxLength={15}
                placeholderTextColor={theme.textLight}
              />
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              value={form.password}
              onChangeText={v => update('password', v)}
              secureTextEntry={!showPassword}
              placeholderTextColor={theme.textLight}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[styles.inputWrapper, form.confirmPassword && form.confirmPassword !== form.password && styles.inputError]}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChangeText={v => update('confirmPassword', v)}
              secureTextEntry={!showPassword}
              placeholderTextColor={theme.textLight}
            />
            {form.confirmPassword && form.confirmPassword === form.password && (
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={handleNext}
          disabled={loading}
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or</Text>
          <View style={styles.dividerLine} />
        </View>

        <GoogleSignInButton title="Sign up with Google" />

        <TouchableOpacity 
          style={styles.loginLink} 
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardWrapper>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  form: { padding: SPACING.lg, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: {
    fontSize: FONTS.xs, fontWeight: '700', color: theme.textSecondary,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: theme.border,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  inputDisabled: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
    borderColor: theme.border,
    opacity: 0.8,
  },
  inputError: { borderColor: theme.error },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: FONTS.base, color: theme.text },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 24 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: RADIUS.full },
  nextBtnText: { color: theme.textWhite, fontSize: FONTS.lg, fontWeight: '700' },
  loginLink: { marginTop: 24, alignItems: 'center', paddingBottom: 20 },
  loginLinkText: { fontSize: FONTS.sm, color: theme.textSecondary },
  loginLinkBold: { color: theme.teal, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { fontSize: FONTS.sm, color: theme.textLight },
});
