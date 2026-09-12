import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ImageBackground, StatusBar, Image, ScrollView,
  Platform, ActivityIndicator, Alert, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
  interpolate,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { fetchRandomTravelImages, getRichDestinations } from '../api/imageService';
import { aiAPI, userAPI, authAPI } from '../api/services';
import GoogleSignInButton from '../components/GoogleSignInButton';

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setUser, setToken } from '../store/slices/authSlice';
import { setSavedDestinations } from '../store/slices/savedSlice';
import apiClient from '../api/client';

const { width, height } = Dimensions.get('window');

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '898480493172-uel9195jfcbbrp655ajv21frtsblpd5g.apps.googleusercontent.com',
  offlineAccess: true,
});

const EXPLORER_TYPES = [
  { id: 'solo', label: 'Solo', icon: 'person', family: 'Ionicons' },
  { id: 'adventure', label: 'Adventure', icon: 'map', family: 'Ionicons' },
  { id: 'hidden_gems', label: 'Hidden Gems', icon: 'diamond', family: 'MaterialCommunityIcons', highlight: true },
  { id: 'wellness', label: 'Wellness', icon: 'leaf', family: 'Ionicons' },
  { id: 'spiritual', label: 'Spiritual', icon: 'moon', family: 'Ionicons' },
];

const STORY_MESSAGES = [
  "Your journey is more than just a destination...",
  "It's a collection of moments...",
  "Waiting to be discovered.",
  "The world is a book, and those who do not travel read only one page.",
  "Travel is the only thing you buy that makes you richer.",
  "Collect moments, not things.",
  "To travel is to live.",
  "Discovery consists not in seeking new landscapes, but in having new eyes.",
  "Not all those who wander are lost.",
  "Adventure is worthwhile.",
  "Travel far enough, you meet yourself.",
  "Your next hidden gem is just a swipe away.",
  "Don't just see the world, experience it.",
  "Find your tribe among the mountains.",
  "Where the road ends, the journey begins.",
  "Every traveler has a story. What's yours?",
  "Discover the unseen, embrace the unknown.",
  "Life is either a daring adventure or nothing at all."
];

const LandingScreen = () => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // States
  const [heroImage, setHeroImage] = useState('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1000&auto=format&fit=crop');
  const [selectedExplorer, setSelectedExplorer] = useState('hidden_gems');
  const [storyIndex, setStoryIndex] = useState(Math.floor(Math.random() * STORY_MESSAGES.length));
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animation Shared Values
  const storyOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  // Storytelling Rotation Logic
  useEffect(() => {
    storyOpacity.value = 0;
    storyOpacity.value = withTiming(1, { duration: 1500 });

    const interval = setInterval(() => {
      storyOpacity.value = withTiming(0, { duration: 1000 }, (finished) => {
        if (finished) {
          runOnJS(setStoryIndex)(Math.floor(Math.random() * STORY_MESSAGES.length));
          storyOpacity.value = withTiming(1, { duration: 1500 });
        }
      });
    }, 6000); // Increased time slightly for better readability

    return () => clearInterval(interval);
  }, []);

  // Background Rotation Logic
  useEffect(() => {
    loadInitialData();
    const bgInterval = setInterval(loadInitialData, 12000);
    return () => clearInterval(bgInterval);
  }, []);

  const loadInitialData = async () => {
    try {
      const imgs = await fetchRandomTravelImages(1);
      if (imgs && imgs.length > 0) setHeroImage(imgs[0].image);
    } catch (err) {
      console.warn('Landing data load failed:', err);
    }
  };

  const storyStyle = useAnimatedStyle(() => ({
    opacity: storyOpacity.value,
    transform: [{ translateY: interpolate(storyOpacity.value, [0, 1], [10, 0]) }]
  }));

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(buttonScale.value) }]
  }));

  const handleStart = async () => {
    buttonScale.value = withSpring(0.9, { damping: 10 }, () => {
      buttonScale.value = withSpring(1);
    });

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try { await GoogleSignin.signOut(); } catch (e) {}
      
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        Alert.alert('Error', 'Could not get ID token from Google.');
        setLoading(false);
        return;
      }

      const res = await authAPI.googleLogin(idToken);
      
      if (res.data.isNewUser) {
        setLoading(false);
        (navigation.navigate as any)('Register_Step1', { googleProfile: res.data.googleProfile });
        return;
      }

      const { token, user, isDeletionPending } = res.data;
      
      if (isDeletionPending) {
        setLoading(false);
        handleRestoreAccount(token, user);
        return;
      }

      await finishLogin(token, user);
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Sign-In Failed', error.message || 'An unknown error occurred.');
      }
      setLoading(false);
    }
  };

  const handleRestoreAccount = (token: string, user: any) => {
    Alert.alert(
      'Restore Account?',
      'Your account is scheduled for deletion. Restore now?',
      [
        { text: 'Keep Scheduled', style: 'destructive' },
        { text: 'Restore Now', onPress: async () => {
          try {
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            const restoreRes = await userAPI.restoreAccount();
            await finishLogin(token, restoreRes.data.user);
            Alert.alert('Success', 'Account restored! ✨');
          } catch (e) {
            Alert.alert('Error', 'Failed to restore.');
          }
        }}
      ]
    );
  };

  const finishLogin = async (token: string, user: any) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    dispatch(setToken(token));
    dispatch(setUser(user));
    if (user.savedDestinations) dispatch(setSavedDestinations(user.savedDestinations));
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Cinematic Background */}
      <ImageBackground source={{ uri: heroImage }} style={styles.hero} resizeMode="cover">
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.heroOverlay}
        >
          <SafeAreaView style={styles.heroHeader}>
            <View style={styles.headerRow}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setAboutModalVisible(true)}>
                <Animated.View entering={FadeIn.delay(200)} style={styles.logoTag}>
                  <Image source={require('../../assets/logo.png')} style={{ width: 22, height: 22, borderRadius: 6 }} />
                  <Text style={styles.logoTagText}>EKAL<Text style={{ color: '#F7A731' }}>GO</Text></Text>
                </Animated.View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.loginLinkSmall}
                onPress={() => (navigation.navigate as any)('Login')}
              >
                <Text style={styles.loginLinkSmallText}>Login</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Animated Storytelling */}
          <View style={styles.storyContainer}>
            <Animated.Text style={[styles.storyText, storyStyle]}>
              {STORY_MESSAGES[storyIndex]}
            </Animated.Text>
          </View>

          {/* Explorer Selection & Action */}
          <View style={styles.onboardingBottom}>
            <Text style={styles.onboardingTitle}>What kind of explorer are you?</Text>
            
            <View style={styles.explorerGrid}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.explorerScroll}
              >
                {EXPLORER_TYPES.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedExplorer(item.id)}
                    style={[
                      styles.explorerBtn,
                      selectedExplorer === item.id && styles.explorerBtnActive,
                      item.highlight && styles.explorerBtnHighlight
                    ]}
                  >
                    {item.family === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons 
                        name={item.icon as any} 
                        size={18} 
                        color={selectedExplorer === item.id ? '#fff' : 'rgba(255,255,255,0.7)'} 
                      />
                    ) : (
                      <Ionicons 
                        name={item.icon as any} 
                        size={18} 
                        color={selectedExplorer === item.id ? '#fff' : 'rgba(255,255,255,0.7)'} 
                      />
                    )}
                    <Text style={[
                      styles.explorerLabel,
                      selectedExplorer === item.id && styles.explorerLabelActive
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Main Action Button */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleStart}
              disabled={loading}
              style={styles.mainActionBtnWrapper}
            >
              <Animated.View style={[styles.mainActionBtn, btnAnimatedStyle]}>
                <LinearGradient
                  colors={['#14c8c4', '#00A8E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.mainActionGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.mainActionText}>Begin Your Journey</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => (navigation.navigate as any)('Register_Step1')}
              style={styles.joinLink}
            >
              <Text style={styles.joinLinkText}>Don't have an account? <Text style={{ color: '#14c8c4' }}>Join now</Text></Text>
            </TouchableOpacity>
          </View>

          <View style={styles.onboardingFooter}>
             <Text style={styles.footerLegal}>
                By continuing, you agree to our <Text style={styles.legalLink}>Terms</Text> and <Text style={styles.legalLink}>Privacy</Text>
             </Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* About App Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={aboutModalVisible}
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <View style={styles.aboutModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setAboutModalVisible(false)} />
          <View style={[styles.aboutModalContent, { backgroundColor: theme.mode === 'dark' ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)' }]}>
            <LinearGradient
              colors={['rgba(0,201,167,0.15)', 'transparent']}
              style={styles.aboutHeaderGradient}
            />

            <View style={styles.aboutHeaderHandle} />

            <ScrollView contentContainerStyle={styles.aboutScroll} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Image source={require('../../assets/logo.png')} style={{ width: 45, height: 45, borderRadius: 12, marginRight: 15 }} />
                <View>
                  <Text style={[styles.aboutHeaderTitle, { color: theme.text }]}>
                    EKAL<Text style={{ color: '#F7A731' }}>GO</Text>
                  </Text>
                  <Text style={styles.aboutHeaderSubtitle}>From Solo Trips to Shared Memories.</Text>
                </View>
              </View>

              <Text style={[styles.aboutDescription, { color: theme.text }]}>
                Experience a revolutionary travel platform that connects you with global explorers, AI-curated itineraries, and breathtaking destinations instantly.
              </Text>

              <View style={styles.featuresList}>
                <View style={[styles.featureItem, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="compass" size={20} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.featureText, { color: theme.text }]}>Discover Hidden Gems</Text>
                </View>
                <View style={[styles.featureItem, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="chatbubbles" size={20} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.featureText, { color: theme.text }]}>Connect with Travelers</Text>
                </View>
                <View style={[styles.featureItem, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="map" size={20} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.featureText, { color: theme.text }]}>AI-Powered Itineraries</Text>
                </View>
              </View>

              <Text style={[styles.aboutSectionTitle, { color: theme.text }]}>Why Choose EkalGo?</Text>
              <View style={styles.bulletPointsContainer}>
                <View style={styles.bulletPointRow}><Text style={styles.bulletDot}>•</Text><Text style={[styles.bulletPointText, { color: theme.textLight }]}>Real-time location matching</Text></View>
                <View style={styles.bulletPointRow}><Text style={styles.bulletDot}>•</Text><Text style={[styles.bulletPointText, { color: theme.textLight }]}>Instant messaging and media sharing</Text></View>
                <View style={styles.bulletPointRow}><Text style={styles.bulletDot}>•</Text><Text style={[styles.bulletPointText, { color: theme.textLight }]}>Community-driven rich travel data</Text></View>
              </View>

              <View style={styles.aboutQuoteBox}>
                <FontAwesome5 name="quote-left" size={14} color={COLORS.teal} style={{ marginBottom: 8 }} />
                <Text style={[styles.aboutQuoteText, { color: theme.text }]}>
                  "To travel is to discover that everyone is wrong about other countries."
                </Text>
              </View>

              <View style={styles.aboutFooter}>
                <Text style={styles.craftedText}>Crafted with passion by</Text>
                <Text style={[styles.teamTitle, { color: theme.text }]}>Team EkalGo</Text>
                <Text style={styles.taglineText}>Driven by curiosity, built for explorers</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setAboutModalVisible(false)}
              >
                <LinearGradient
                  colors={['#00C9A7', '#00A8E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aboutBtn}
                >
                  <Text style={styles.aboutBtnText}>Start Exploring</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  hero: { width: width, height: height },
  heroOverlay: { flex: 1, paddingBottom: 40, justifyContent: 'space-between' },
  heroHeader: { paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 40 : 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoTag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backdropBlur: 10,
  },
  logoTagText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  loginLinkSmall: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  loginLinkSmallText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  storyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  storyText: {
    color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center',
    lineHeight: 42, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },

  onboardingBottom: { paddingHorizontal: 24, paddingBottom: 20 },
  onboardingTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  explorerGrid: { marginBottom: 30 },
  explorerScroll: { gap: 12, paddingRight: 20 },
  explorerBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', gap: 8
  },
  explorerBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: '#fff' },
  explorerBtnHighlight: { backgroundColor: 'rgba(20,200,196,0.15)', borderColor: 'rgba(20,200,196,0.5)' },
  explorerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  explorerLabelActive: { color: '#fff' },

  mainActionBtnWrapper: { width: '100%', marginBottom: 20 },
  mainActionBtn: { height: 64, borderRadius: 32, ...SHADOW.lg },
  mainActionGradient: {
    flex: 1, borderRadius: 32, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 10,
  },
  mainActionText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  joinLink: { alignSelf: 'center' },
  joinLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },

  onboardingFooter: { paddingBottom: 20 },
  footerLegal: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 11 },
  legalLink: { textDecorationLine: 'underline' },

  aboutModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  aboutModalContent: {
    borderTopLeftRadius: 35, borderTopRightRadius: 35,
    minHeight: height * 0.75, maxHeight: height * 0.9,
    paddingTop: 15, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  aboutHeaderHandle: { width: 40, height: 5, backgroundColor: 'rgba(150,150,150,0.3)', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  aboutHeaderGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, borderTopLeftRadius: 35, borderTopRightRadius: 35 },
  aboutScroll: { paddingBottom: 20 },
  aboutHeaderTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  aboutHeaderSubtitle: { fontSize: 16, color: COLORS.teal, fontWeight: '700', marginTop: 4, marginBottom: 24 },
  aboutDescription: { fontSize: 15, lineHeight: 24, opacity: 0.8, marginBottom: 30 },
  featuresList: { gap: 12, marginBottom: 30 },
  featureItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16 },
  featureIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,201,167,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  featureText: { fontSize: 16, fontWeight: '700' },
  aboutSectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  bulletPointsContainer: { gap: 10, marginBottom: 30 },
  bulletPointRow: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 20 },
  bulletDot: { fontSize: 18, color: COLORS.teal, marginRight: 10, lineHeight: 22 },
  bulletPointText: { fontSize: 15, lineHeight: 22 },
  aboutQuoteBox: { backgroundColor: 'rgba(0,201,167,0.05)', padding: 20, borderRadius: 20, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(0,201,167,0.1)' },
  aboutQuoteText: { fontSize: 16, fontStyle: 'italic', fontWeight: '500', lineHeight: 24 },
  aboutFooter: { alignItems: 'center', marginBottom: 35 },
  craftedText: { fontSize: 12, color: 'gray', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  teamTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  taglineText: { fontSize: 14, color: COLORS.teal, fontStyle: 'italic', fontWeight: '600' },
  aboutBtn: { width: '100%', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', ...SHADOW.lg },
  aboutBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});


export default LandingScreen;
