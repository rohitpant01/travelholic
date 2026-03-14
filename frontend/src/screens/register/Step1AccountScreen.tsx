import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RegisterHeader from '../../components/RegisterHeader';
import { authAPI } from '../../api/services';
import { setUser, setToken } from '../../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';
import apiClient from '../../api/client';

export default function Step1AccountScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '',
    email: '', phone: '', password: '', confirmPassword: '',
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleNext = async () => {
    const { firstName, lastName, username, email, phone, password, confirmPassword } = form;
    if (!firstName || !lastName || !username || !email || !phone || !password) {
      return Alert.alert('Error', 'Please fill in all fields');
    }
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters');
    if (password !== confirmPassword) return Alert.alert('Error', 'Passwords do not match');
    if (!phone.startsWith('+')) return Alert.alert('Error', 'Phone must include country code (e.g. +91...)');

    setLoading(true);
    try {
      console.log('[REG] Attempting registration for:', email);
      const res = await authAPI.register({ firstName, lastName, username, email, phone, password });
      const { token, user } = res.data;
      console.log('[REG] Registration success. User ID:', user._id);
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      dispatch(setToken(token));
      dispatch(setUser(user));
      
      console.log('[REG] Navigating to OTP verification screen');
      navigation.navigate('Register_Step2', { phone, userId: user._id });
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
    { key: 'phone', label: 'Phone Number', icon: 'call-outline', placeholder: '+919876543210', phone: true },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RegisterHeader step={1} totalSteps={7} title="Create Account" subtitle="Tell us about yourself" />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        {fields.map(f => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name={f.icon as any} size={18} color={COLORS.textLight} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChangeText={v => update(f.key, f.lower ? v.toLowerCase() : v)}
                autoCapitalize={f.lower || f.email ? 'none' : 'words'}
                keyboardType={f.email ? 'email-address' : f.phone ? 'phone-pad' : 'default'}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          </View>
        ))}

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              value={form.password}
              onChangeText={v => update('password', v)}
              secureTextEntry={!showPassword}
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[styles.inputWrapper, form.confirmPassword && form.confirmPassword !== form.password && styles.inputError]}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChangeText={v => update('confirmPassword', v)}
              secureTextEntry={!showPassword}
              placeholderTextColor={COLORS.textLight}
            />
            {form.confirmPassword && form.confirmPassword === form.password && (
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={handleNext}
          disabled={loading}
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

        <TouchableOpacity 
          style={styles.loginLink} 
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: SPACING.lg, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: {
    fontSize: FONTS.xs, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  inputError: { borderColor: COLORS.error },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: FONTS.base, color: COLORS.text },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 24 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: RADIUS.full },
  nextBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
  loginLink: { marginTop: 24, alignItems: 'center', paddingBottom: 20 },
  loginLinkText: { fontSize: FONTS.sm, color: COLORS.textSecondary },
  loginLinkBold: { color: COLORS.teal, fontWeight: '700' },
});
