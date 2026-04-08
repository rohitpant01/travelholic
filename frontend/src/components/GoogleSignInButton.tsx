import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Image as RNImage } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, userAPI } from '../api/services';
import { setUser, setToken } from '../store/slices/authSlice';
import { setSavedDestinations } from '../store/slices/savedSlice';
import { useAppTheme, FONTS, RADIUS } from '../utils/theme';
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
  const theme = useAppTheme();
  const styles = getStyles(theme);

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
                  const restoreRes = await userAPI.restoreAccount();
                  const restoredUser = restoreRes.data.user;
                  await finishGoogleLogin(token, restoredUser);
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

      await finishGoogleLogin(token, user);
    } catch (error: any) {
      console.error('Google login error', error);
      Alert.alert('Google Sign-In Failed', error.response?.data?.error || 'Could not verify Google account');
    }
  };

  const finishGoogleLogin = async (token: string, user: any) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    dispatch(setToken(token));
    dispatch(setUser(user));
    if (user.savedDestinations) {
      dispatch(setSavedDestinations(user.savedDestinations));
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
        <ActivityIndicator color={theme.text} />
      ) : (
        <>
          <Text style={styles.text}>{title}</Text>
          <RNImage
            source={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }}
            style={styles.logo}
          />
        </>
      )}
    </TouchableOpacity>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.mode === 'dark' ? '#131314' : theme.white,
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? '#444746' : '#E5E7EB',
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
    marginLeft: 10,
  },
  text: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: theme.mode === 'dark' ? '#E3E3E3' : '#374151',
  },
  disabled: {
    opacity: 0.7,
  },
});
