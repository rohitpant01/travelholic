import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/services';
import { setUser, setToken } from '../store/slices/authSlice';
import { COLORS, FONTS, RADIUS } from '../utils/theme';
import apiClient from '../api/client';

WebBrowser.maybeCompleteAuthSession();

// Note: Replace these with your actual Client IDs from Google Cloud Console
const webClientId = '501144459095-tqeh6a5a6stgcb4dlb8hvd70daa0fcqv.apps.googleusercontent.com';
const iosClientId = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const androidClientId = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';

export default function GoogleSignInButton({ title = "Continue with Google" }: { title?: string }) {
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    iosClientId: iosClientId,
    androidClientId: androidClientId,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    } else if (response?.type === 'error') {
      Alert.alert('Authentication Error', 'Failed to authenticate with Google.');
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      const res = await authAPI.googleLogin(idToken);
      const { token, user } = res.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      dispatch(setToken(token));
      dispatch(setUser(user));

      // If user is from Google but hasn't completed phone verification,
      // the backend assigns them registrationStep: 2 and a dummy phone.
      if (user.registrationStep === 2 && user.phone.startsWith('google_')) {
        navigation.navigate('Register_Step2', { phone: '', userId: user._id });
        return;
      }
      
    } catch (error: any) {
      console.error('Google login error', error);
      Alert.alert('Google Sign-In Failed', error.response?.data?.error || 'Could not verify Google account');
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (webClientId.includes('YOUR_WEB_CLIENT_ID')) {
      Alert.alert(
        "Configuration Missing", 
        "Please provide your Google Web Client ID in frontend/src/components/GoogleSignInButton.tsx to enable Google Auth."
      );
      return;
    }
    promptAsync();
  };

  return (
    <TouchableOpacity
      style={[styles.container, loading && styles.disabled]}
      onPress={handlePress}
      disabled={loading || !request}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.text} />
      ) : (
        <>
          <Image 
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
