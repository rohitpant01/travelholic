import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, ScrollView, Platform, Animated, Easing
} from 'react-native';
import React, { useState, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { userAPI } from '../../api/services';
import { updateUser } from '../../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../utils/theme';

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

  const scanAnim = useRef(new Animated.Value(0)).current;
  const [scanStatus, setScanStatus] = useState('');

  const startScanAnim = () => {
    scanAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 220,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const stopScanAnim = () => {
    scanAnim.stopAnimation();
  };

  const handleVerify = async () => {
    if (!selfieUri) return Alert.alert('Error', 'Please take a live selfie first');

    setLoading(true);
    setScanStatus('Scanning Face...');
    startScanAnim();
    
    // Realistic status cycle
    const statuses = ['Analyzing Geometry...', 'Checking Biometrics...', 'Comparing with Profile...', 'Finalizing...'];
    let statusIdx = 0;
    const interval = setInterval(() => {
      if (statusIdx < statuses.length) {
        setScanStatus(statuses[statusIdx]);
        statusIdx++;
      }
    }, 1200);

    try {
      const formData = new FormData();
      const cleanPath = selfieUri.split('?')[0];
      const extension = cleanPath.split('.').pop()?.toLowerCase() || 'jpg';
      const type = extension === 'png' ? 'image/png' : 'image/jpeg';
      const name = `selfie_${Date.now()}.${extension}`;
      const finalUri = Platform.OS === 'android' && !selfieUri.startsWith('file://') ? `file://${selfieUri}` : selfieUri;

      formData.append('selfie', {
        uri: finalUri,
        name: name,
        type: type,
      } as any);

      const res = await userAPI.verifySelfie(formData);
      
      setTimeout(() => {
        setResult(res.data);
        dispatch(updateUser({ isPhotoVerified: res.data.verified }));
        clearInterval(interval);
        stopScanAnim();
        setLoading(false);
      }, 1000);
    } catch (error: any) {
      clearInterval(interval);
      stopScanAnim();
      setLoading(false);
      console.error('VERIFICATION UPLOAD ERROR:', error);
      let msg = 'Verification failed';
      if (error.response?.data?.error) {
        msg = error.response.data.error;
      } else if (error.message) {
        msg = `${error.message}${error.code ? ` (${error.code})` : ''}`;
      }
      Alert.alert('Error', msg);
    }
  };

  const handleSkip = () => navigation.replace('MainTabs');
  const handleContinue = () => navigation.replace('MainTabs');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.header}>
        <Text style={styles.headerEmoji}>🛡️</Text>
        <Text style={styles.headerTitle}>Photo Verification</Text>
        <Text style={styles.headerSubtitle}>Verify your identity with a live selfie</Text>
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

        <View style={styles.selfieOuter}>
          <View style={styles.selfieContainer}>
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
            ) : (
              <View style={styles.selfiePlaceholder}>
                <Ionicons name="camera" size={48} color={COLORS.textLight} />
                <Text style={styles.selfiePlaceholderText}>Position your face within the circle</Text>
              </View>
            )}
            
            {/* Guide Circle Overlay */}
            {!result && (
              <View style={styles.guideOverlay}>
                <View style={styles.guideCircle} />
              </View>
            )}

            {/* Scanning Animation */}
            {loading && (
              <View style={styles.scanningContainer}>
                <Animated.View 
                  style={[
                    styles.scanningBar,
                    { transform: [{ translateY: scanAnim }] }
                  ]}
                >
                  <LinearGradient
                    colors={['transparent', COLORS.teal, 'transparent']}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <View style={styles.scanningLabel}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.scanningLabelText}>{scanStatus}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.cameraBtn, loading && styles.btnDisabled]} onPress={takeSelfie} disabled={loading}>
            <Ionicons name="camera" size={24} color={COLORS.teal} />
            <Text style={styles.cameraBtnText}>Open Camera to Verify</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={[styles.resultCard, result.verified ? styles.resultSuccess : styles.resultFail]}>
            <Text style={styles.resultEmoji}>{result.verified ? '✅' : '❌'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>
                {result.verified ? 'Identity Verified!' : 'Verification Failed'}
              </Text>
              <Text style={styles.resultText}>
                {result.verified
                  ? `Accuracy: ${result.similarity}% match! 🏅`
                  : `Accuracy: ${result.similarity}% match — please try again.`}
              </Text>
            </View>
          </View>
        )}

        {selfieUri && !result && (
          <TouchableOpacity
            style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
            onPress={handleVerify} disabled={loading}
          >
            <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.verifyBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.verifyBtnText}>{loading ? 'Analyzing Face...' : 'Verify My Identity'}</Text>
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

        {!result && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={loading}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
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
  selfieOuter: { 
    alignSelf: 'center', 
    marginBottom: 20, 
    position: 'relative',
    ...SHADOW.md,
  },
  selfieContainer: {
    width: 220, height: 220, borderRadius: 110,
    overflow: 'hidden', backgroundColor: COLORS.background,
    borderWidth: 4, borderColor: COLORS.white,
    position: 'relative',
  },
  selfieImage: { width: '100%', height: '100%' },
  selfiePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  selfiePlaceholderText: { fontSize: FONTS.xs, color: COLORS.textLight, textAlign: 'center' },
  
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  guideCircle: {
    width: 160, height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderStyle: 'dashed',
  },

  scanningContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningBar: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.teal,
    position: 'absolute',
    top: 0,
    zIndex: 10,
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  scanningLabel: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanningLabelText: {
    color: COLORS.white,
    fontSize: FONTS.sm,
    fontWeight: '600',
  },

  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  cameraBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderColor: COLORS.teal, borderRadius: RADIUS.md, paddingVertical: 12,
  },
  btnDisabled: { opacity: 0.5 },
  cameraBtnText: { color: COLORS.teal, fontWeight: '600', fontSize: FONTS.base },
  resultCard: { 
    flexDirection: 'row', alignItems: 'center', 
    borderRadius: RADIUS.lg, padding: 16, marginBottom: 16, gap: 12 
  },
  resultSuccess: { backgroundColor: '#E8F8F0', borderWidth: 1, borderColor: '#B7EB8F' },
  resultFail: { backgroundColor: '#FEF0EF', borderWidth: 1, borderColor: '#FFCCC7' },
  resultEmoji: { fontSize: 32 },
  resultTitle: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  resultText: { fontSize: FONTS.xs, color: COLORS.textSecondary, marginTop: 2 },
  verifyBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 12 },
  verifyBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  verifyBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
  continueBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 12 },
  continueBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: COLORS.textLight, fontSize: FONTS.base },
});
