import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { authAPI, userAPI } from '../api/services';
import { setUser, setToken } from '../store/slices/authSlice';
import { setSavedDestinations } from '../store/slices/savedSlice';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import apiClient from '../api/client';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { getLocalBucketList, clearLocalBucketList } from '../utils/bucketListUtils';
import storage from '../utils/storage';


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
      const { token, user, isDeletionPending } = res.data;
      
      if (isDeletionPending) {
        setLoading(false);
        Alert.alert(
          'Restore Account?',
          'Your account is scheduled for deletion. Would you like to cancel the deletion and restore your account?',
          [
            {
              text: 'Keep Scheduled',
              style: 'destructive',
              onPress: () => {
                // Do not finish login. Keep user on login screen to prevent 401 glitch.
                Alert.alert('Notice', 'You must restore your account to log in. It will be permanently deleted after 7 days.');
              }
            },
            {
              text: 'Restore Now',
              onPress: async () => {
                try {
                  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                  await userAPI.restoreAccount();
                  user.isDeleted = false; // Optimistic update
                  await finishLogin(token, user);
                  Alert.alert('Success', 'Your account has been fully restored! ✨');
                } catch (e) {
                  Alert.alert('Error', 'Failed to restore account. Please try again later.');
                }
              }
            }
          ]
        );
        return;
      }

      await finishLogin(token, user);
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = async (token: string, user: any) => {
    // 🛡️ Securely store tokens for Play Store Compliance
    await storage.setSecureItem('token', token);
    await storage.setItem('user', user);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const localItems = await getLocalBucketList();
    if (localItems.length > 0) {
      try {
        await userAPI.syncSavedDestinations(localItems);
        await clearLocalBucketList();
      } catch (syncError) {}
    }

    dispatch(setToken(token));
    dispatch(setUser(user));
    if (user.savedDestinations) {
      dispatch(setSavedDestinations(user.savedDestinations));
    }
  };


  return (
    <KeyboardWrapper 
      backgroundColor={COLORS.white}
      contentContainerStyle={{ flexGrow: 1 }}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 40, height: 40, borderRadius: 10, marginRight: 12 }} />
          <Text style={styles.headerTitle}>
            EKAL<Text style={{ color: '#F7A731' }}>GO</Text>
          </Text>
        </View>
        <Text style={styles.headerSubtitle}>Sign in to continue your journey</Text>
      </LinearGradient>

      <View style={styles.form}>
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
          <Text style={styles.dividerText}>New to EkalGo?</Text>
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

      </View>
    </KeyboardWrapper>
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
