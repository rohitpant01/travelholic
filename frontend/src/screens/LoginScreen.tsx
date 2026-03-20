import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../api/services';
import { setUser, setToken } from '../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import apiClient from '../api/client';
import GoogleSignInButton from '../components/GoogleSignInButton';


export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    let finalIdentifier = emailOrPhone.trim();
    // Auto +91 if it's 10 digits
    if (/^\d{10}$/.test(finalIdentifier)) {
      finalIdentifier = `+91${finalIdentifier}`;
    }

    setLoading(true);
    try {
      const res = await authAPI.login({ emailOrPhone: finalIdentifier, password });
      const { token, user } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      dispatch(setToken(token));
      dispatch(setUser(user));
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.replace('Landing');
          }
        }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Welcome Back ✈️</Text>
        <Text style={styles.headerSubtitle}>Sign in to continue your journey</Text>
      </LinearGradient>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Email or Mobile Number</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={20} color={COLORS.textLight} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email or 10-digit mobile"
            value={emailOrPhone}
            onChangeText={setEmailOrPhone}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.textLight} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.forgotBtn}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.teal, COLORS.tealDark]}
            style={styles.loginBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>


        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>New to TravelHolic?</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => navigation.navigate('Register_Step1')}
        >
          <Text style={styles.registerText}>Create Account</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={{ marginBottom: 40 }}>
          <GoogleSignInButton title="Sign in with Google" />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60, paddingBottom: 36, paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 20 },
  headerTitle: {
    fontSize: FONTS.xxxl, fontWeight: '800', color: COLORS.white, marginBottom: 6,
  },
  headerSubtitle: { fontSize: FONTS.md, color: 'rgba(255,255,255,0.8)' },
  form: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.lg },
  label: {
    fontSize: FONTS.sm, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: FONTS.base, color: COLORS.text },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 28 },
  forgotText: { color: COLORS.teal, fontSize: FONTS.sm, fontWeight: '600' },
  loginBtn: { borderRadius: RADIUS.full, overflow: 'hidden' },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  loginBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 28, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: FONTS.sm, color: COLORS.textLight },
  registerBtn: {
    borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.teal,
    paddingVertical: 14, alignItems: 'center',
  },
  registerText: { color: COLORS.teal, fontSize: FONTS.lg, fontWeight: '600' },
});
