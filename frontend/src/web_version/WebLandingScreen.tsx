import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  Image, ScrollView, Dimensions, Platform, ActivityIndicator 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { COLORS, SHADOW, RADIUS, SPACING } from '../utils/theme';
import ItineraryTeaser from './ItineraryTeaser';
import WaitlistModal from './WaitlistModal';

const { width, height } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function WebLandingScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingPlaces, setTrendingPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [teaserItinerary, setTeaserItinerary] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      const res = await axios.get(`${API_URL}/ai/teaser/search?query=Uttarakhand`);
      setTrendingPlaces(res.data);
    } catch (e) {
      console.warn("Trending fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await axios.post(`${API_URL}/ai/teaser/itinerary`, { destination: searchQuery });
      setTeaserItinerary(res.data);
      // Scroll to teaser after short delay
      setTimeout(() => {
        // scroll logic if needed
      }, 500);
    } catch (e) {
      setShowWaitlist(true); // Fallback to waitlist if AI fails or rate limited
    } finally {
      setSearching(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 🚀 HERO SECTION */}
      <View style={styles.hero}>
        <LinearGradient 
          colors={['#001020', '#0a1a2f', '#020510']} 
          style={StyleSheet.absoluteFillObject} 
        />
        
        <View style={styles.nav}>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} />
            <Text style={styles.logoText}>EKAL<Text style={{color: '#F7A731'}}>GO</Text></Text>
          </View>
          <TouchableOpacity style={styles.waitlistBtn} onPress={() => setShowWaitlist(true)}>
             <Text style={styles.waitlistBtnText}>Join Waitlist 🚀</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>The Smartest Way to Explore India.</Text>
          <Text style={styles.heroSubtitle}>
            AI-powered itineraries, hidden gems Discovery, and real travel insights – 
            all in one app.
          </Text>

          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g., Delhi to Munsyari..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Generate Preview</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
               <Text style={styles.statNum}>1,200+</Text>
               <Text style={styles.statTag}>Users Waiting</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
               <Text style={styles.statNum}>15,000+</Text>
               <Text style={styles.statTag}>Gems Discovered</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 🧭 TEASER CONTENT (Condition rendering) */}
      {teaserItinerary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Previewing: {teaserItinerary.destination}</Text>
          <ItineraryTeaser data={teaserItinerary} onUnlock={() => setShowWaitlist(true)} />
        </View>
      )}

      {/* ⭐ TRENDING SECTION */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>Trending Destinations</Text>
           <Text style={styles.sectionSubtitle}>Discover the most searched places this week</Text>
        </View>
        
        <View style={styles.trendingGrid}>
          {loading ? (
            <ActivityIndicator color={COLORS.teal} />
          ) : (
            trendingPlaces.map((place, idx) => (
              <TouchableOpacity key={idx} style={styles.placeCard} activeOpacity={0.9} onPress={() => setShowWaitlist(true)}>
                <Image source={{ uri: place.image }} style={styles.placeImg} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.placeOverlay}>
                   <Text style={styles.placeName}>{place.name}</Text>
                   <Text style={styles.placeLoc}>{place.location}</Text>
                </LinearGradient>
                <View style={styles.lockBadge}>
                   <Ionicons name="lock-closed" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* 📱 APP TEASER SECTION */}
      <LinearGradient colors={['#f8f9fa', '#e9ecef']} style={styles.teaserSection}>
         <View style={styles.teaserText}>
            <Text style={styles.teaserHeading}>Why you'll love the App 🔥</Text>
            <View style={styles.featureItem}>
               <Ionicons name="flash" size={24} color={COLORS.teal} />
               <Text style={styles.featLabel}>Real-time Smart Route Optimization 🔒</Text>
            </View>
            <View style={styles.featureItem}>
               <Ionicons name="map" size={24} color={COLORS.teal} />
               <Text style={styles.featLabel}>Nearby "Hidden Places" Tracker 🔒</Text>
            </View>
            <View style={styles.featureItem}>
               <Ionicons name="people" size={24} color={COLORS.teal} />
               <Text style={styles.featLabel}>Connect with Real-time Travelers 🔒</Text>
            </View>
         </View>
         <View style={styles.teaserImgWrap}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1512341689857-198e7e2f3ca8?q=80&w=1000' }} style={styles.mockupImg} />
         </View>
      </LinearGradient>

      {/* 📩 FOOTER / CTA */}
      <View style={styles.footer}>
         <Text style={styles.footerTitle}>EkalGo is Launching Soon!</Text>
         <Text style={styles.footerDesc}>Be the first to explore hidden gems. Join the elite waitlist today.</Text>
         <TouchableOpacity style={styles.finalCta} onPress={() => setShowWaitlist(true)}>
            <Text style={styles.finalCtaText}>Get Early Access 🚀</Text>
         </TouchableOpacity>
         <Text style={styles.copyright}>© 2026 EkalGo. All Rights Reserved.</Text>
      </View>

      <WaitlistModal visible={showWaitlist} onClose={() => setShowWaitlist(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  hero: { width: '100%', minHeight: 600, paddingBottom: 100 },
  nav: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: '10%', paddingVertical: 30, zIndex: 10 
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, borderRadius: 10, marginRight: 15 },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  waitlistBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  waitlistBtnText: { color: '#fff', fontWeight: '700' },
  heroContent: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  heroTitle: { fontSize: 64, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 20 },
  heroSubtitle: { fontSize: 18, color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 600, lineHeight: 28, marginBottom: 40 },
  searchBox: { 
    width: '100%', maxWidth: 700, height: 64, backgroundColor: '#fff', borderRadius: 32, 
    flexDirection: 'row', padding: 8, alignItems: 'center', ...SHADOW.lg 
  },
  searchInput: { flex: 1, paddingHorizontal: 25, fontSize: 16, color: '#333' },
  searchBtn: { backgroundColor: COLORS.teal, height: '100%', paddingHorizontal: 30, borderRadius: 24, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  statsRow: { flexDirection: 'row', marginTop: 60, alignItems: 'center', gap: 40 },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 32, fontWeight: '900', color: '#fff' },
  statTag: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginTop: 4 },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  section: { paddingHorizontal: '10%', paddingVertical: 80 },
  sectionHeader: { marginBottom: 40 },
  sectionTitle: { fontSize: 36, fontWeight: '900', color: '#1a1a1a' },
  sectionSubtitle: { fontSize: 16, color: '#666', marginTop: 10 },
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  placeCard: { width: '31%', height: 350, borderRadius: 20, overflow: 'hidden', ...SHADOW.md },
  placeImg: { width: '100%', height: '100%', position: 'absolute' },
  placeOverlay: { ...StyleSheet.absoluteFillObject, padding: 20, justifyContent: 'flex-end' },
  placeName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  placeLoc: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  lockBadge: { position: 'absolute', top: 15, right: 15, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  teaserSection: { paddingHorizontal: '10%', paddingVertical: 100, flexDirection: 'row', alignItems: 'center' },
  teaserText: { flex: 1 },
  teaserHeading: { fontSize: 44, fontWeight: '900', color: '#1a1a1a', marginBottom: 40 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 15 },
  featLabel: { fontSize: 18, color: '#333', fontWeight: '600' },
  teaserImgWrap: { flex: 1, alignItems: 'flex-end' },
  mockupImg: { width: 300, height: 400, borderRadius: 30, transform: [{rotate: '5deg'}] },
  footer: { paddingVertical: 100, alignItems: 'center', backgroundColor: '#020510' },
  footerTitle: { fontSize: 32, fontWeight: '900', color: '#fff' },
  footerDesc: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginTop: 15, textAlign: 'center', maxWidth: 500 },
  finalCta: { marginTop: 40, backgroundColor: '#F7A731', paddingHorizontal: 40, paddingVertical: 20, borderRadius: 35 },
  finalCtaText: { color: '#000', fontWeight: '900', fontSize: 18 },
  copyright: { marginTop: 80, fontSize: 12, color: 'rgba(255,255,255,0.3)' }
});
