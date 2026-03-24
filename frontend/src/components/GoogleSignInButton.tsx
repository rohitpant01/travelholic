import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Image as RNImage } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/services';
import { setUser, setToken } from '../store/slices/authSlice';
import { COLORS, FONTS, RADIUS } from '../utils/theme';
import apiClient from '../api/client';

// 🛠️ Configure Google Sign-In (Web Client ID is needed for idToken)
GoogleSignin.configure({
  webClientId: '898480493172-uel9195jfcbbrp655ajv21frtsblpd5g.apps.googleusercontent.com',
  offlineAccess: true,
});

export default function GoogleSignInButton({ title = "Continue with Google" }: { title?: string }) {
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  const handlePress = async () => {
    setLoading(true);
    try {
      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Force account picker by clearing any active memory of previous sessions
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore error if they are not currently signed in
      }

      // Sign in natively — no proxy, no redirect URIs needed!
      const userInfo = await GoogleSignin.signIn();
      
      console.log('[GOOGLE AUTH] Sign-in successful:', userInfo.data?.user?.email);

      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        Alert.alert('Error', 'Could not get ID token from Google. Please try again.');
        return;
      }

      // Send to your backend
      await handleGoogleLogin(idToken);

    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[GOOGLE AUTH] User cancelled sign-in');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('[GOOGLE AUTH] Sign-in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services are not available on this device.');
      } else {
        console.error('[GOOGLE AUTH] Error:', error);
        Alert.alert('Google Sign-In Failed', error.message || 'An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (idToken: string) => {
    try {
      const res = await authAPI.googleLogin(idToken);
      
      if (res.data.isNewUser) {
        navigation.navigate('Register_Step1', { googleProfile: res.data.googleProfile });
        return;
      }

      const { token, user } = res.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      dispatch(setToken(token));
      dispatch(setUser(user));

    } catch (error: any) {
      console.error('Google login error', error);
      Alert.alert('Google Sign-In Failed', error.response?.data?.error || 'Could not verify Google account');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, loading && styles.disabled]}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.text} />
      ) : (
        <>
          <RNImage
            source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }}
            style={styles.logo}
          />
          <Text style={styles.text}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  logo: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  text: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: '#374151',
  },
  disabled: {
    opacity: 0.7,
  },
});
