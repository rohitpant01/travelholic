import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, ScrollView, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { userAPI } from '../../api/services';
import { updateUser } from '../../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';

export default function VerificationScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ verified?: boolean; similarity?: number } | null>(null);

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Allow camera access');

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!res.canceled && res.assets[0]) {
      setSelfieUri(res.assets[0].uri);
      setResult(null);
    }
  };

  const pickSelfie = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setSelfieUri(res.assets[0].uri);
      setResult(null);
    }
  };

  const handleVerify = async () => {
    if (!selfieUri) return Alert.alert('Error', 'Please take or upload a selfie');

    setLoading(true);
    try {
      const formData = new FormData();
      const uri = Platform.OS === 'ios' ? selfieUri.replace('file://', '') : selfieUri;
      formData.append('selfie', { uri, name: 'selfie.jpg', type: 'image/jpeg' } as any);
      const res = await userAPI.verifySelfie(formData);
      setResult(res.data);
      dispatch(updateUser({ isPhotoVerified: res.data.verified }));
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => navigation.replace('MainTabs');
  const handleContinue = () => navigation.replace('MainTabs');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.header}>
        <Text style={styles.headerEmoji}>🛡️</Text>
        <Text style={styles.headerTitle}>Photo Verification</Text>
        <Text style={styles.headerSubtitle}>Verify your identity to get a verified badge</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.teal} />
            <Text style={styles.infoText}>Face-match selfie with your profile photo</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.teal} />
            <Text style={styles.infoText}>Get a blue verified badge on your profile</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.teal} />
            <Text style={styles.infoText}>80%+ similarity required for verification</Text>
          </View>
        </View>

        <View style={styles.selfieContainer}>
          {selfieUri ? (
            <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
          ) : (
            <View style={styles.selfiePlaceholder}>
              <Ionicons name="camera" size={48} color={COLORS.textLight} />
              <Text style={styles.selfiePlaceholderText}>Your selfie will appear here</Text>
            </View>
          )}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cameraBtn} onPress={takeSelfie}>
            <Ionicons name="camera" size={22} color={COLORS.teal} />
            <Text style={styles.cameraBtnText}>Take Selfie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraBtn} onPress={pickSelfie}>
            <Ionicons name="images" size={22} color={COLORS.teal} />
            <Text style={styles.cameraBtnText}>Upload</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={[styles.resultCard, result.verified ? styles.resultSuccess : styles.resultFail]}>
            <Text style={styles.resultEmoji}>{result.verified ? '✅' : '❌'}</Text>
            <Text style={styles.resultTitle}>
              {result.verified ? 'Identity Verified!' : 'Verification Failed'}
            </Text>
            <Text style={styles.resultText}>
              {result.verified
                ? `${result.similarity}% match — You got the verified badge! 🏅`
                : `${result.similarity}% match — Please try again with a clearer selfie in good lighting`}
            </Text>
          </View>
        )}

        {selfieUri && !result && (
          <TouchableOpacity
            style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
            onPress={handleVerify} disabled={loading}
          >
            <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.verifyBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : (
                <Text style={styles.verifyBtnText}>Verify My Identity</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <LinearGradient colors={[COLORS.orange, '#FF8C5A']} style={styles.continueBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.continueBtnText}>
              {result?.verified ? '🎉 Start Discovering!' : 'Enter App →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 70, paddingBottom: 36, alignItems: 'center', paddingHorizontal: 24 },
  headerEmoji: { fontSize: 52, marginBottom: 12 },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: '800', color: COLORS.white, marginBottom: 8 },
  headerSubtitle: { fontSize: FONTS.md, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  content: { padding: SPACING.lg, paddingBottom: 48 },
  infoCard: {
    backgroundColor: COLORS.tealLight, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 24, gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: FONTS.sm, color: COLORS.teal, flex: 1 },
  selfieContainer: {
    alignSelf: 'center', width: 180, height: 180, borderRadius: 90,
    overflow: 'hidden', backgroundColor: COLORS.background,
    borderWidth: 3, borderColor: COLORS.border, marginBottom: 16,
  },
  selfieImage: { width: '100%', height: '100%' },
  selfiePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  selfiePlaceholderText: { fontSize: FONTS.xs, color: COLORS.textLight, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  cameraBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderColor: COLORS.teal, borderRadius: RADIUS.md, paddingVertical: 12,
  },
  cameraBtnText: { color: COLORS.teal, fontWeight: '600', fontSize: FONTS.base },
  resultCard: { borderRadius: RADIUS.lg, padding: 16, marginBottom: 16, alignItems: 'center', gap: 6 },
  resultSuccess: { backgroundColor: '#E8F8F0' },
  resultFail: { backgroundColor: '#FEF0EF' },
  resultEmoji: { fontSize: 32 },
  resultTitle: { fontSize: FONTS.lg, fontWeight: '700', color: COLORS.text },
  resultText: { fontSize: FONTS.sm, color: COLORS.textSecondary, textAlign: 'center' },
  verifyBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 12 },
  verifyBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  verifyBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
  continueBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 12 },
  continueBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: COLORS.textLight, fontSize: FONTS.base },
});
