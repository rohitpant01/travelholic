import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Image, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Linking, Platform } from 'react-native';
import { discoverAPI } from '../api/services';
import { COLORS, FONTS, SHADOW, RADIUS } from '../utils/theme';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!unmounted) {
            setError('Location permission denied. Please enable it in settings.');
            setLoading(false);
          }
          return;
        }

        // 1. Try last known position for immediate result
        let loc = await Location.getLastKnownPositionAsync();
        
        // 2. Set a timeout for fresh coordinate fetching
        const locationTimeout = setTimeout(() => {
          if (!loc && !unmounted) {
            setError('Location request timed out. Please check your GPS.');
            setLoading(false);
          }
        }, 12000);

        // 3. Get fresh position
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        
        clearTimeout(locationTimeout);
        
        if (unmounted) return;
        if (loc) {
          setLocation(loc);
          const { latitude, longitude } = loc.coords;
          const res = await discoverAPI.getProfiles(latitude, longitude, 'map');
          
          if (res.data && res.data.profiles) {
            const validProfiles = res.data.profiles.filter(
              (p: any) => p.location?.coordinates && 
                          p.location.coordinates.length === 2 && 
                          p.location.coordinates[0] !== 0
            );
            setProfiles(validProfiles);
          }
        } else {
           throw new Error('Could not determine location');
        }
      } catch (err: any) {
        console.error('[MapScreen] Error:', err);
        if (!unmounted) {
          setError(err.message || 'Failed to load nearby travelers. Please try again.');
        }
      } finally {
        if (!unmounted) setLoading(false);
      }
    };

    loadData();
    return () => { unmounted = true; };
  }, []);

  const testGoogleAPI = async () => {
    try {
      const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      if (!key) {
        alert('API Key is EMPTY ❌\nPlease check your .env file or Expo environment variables.');
        return;
      }
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=40.714224,-73.961452&key=${key}`);
      const data = await res.json();
      if (data.status === 'OK') {
        alert('Google API Key is VALID! ✅');
      } else {
        const msg = data.error_message || data.status || 'Unknown error';
        alert(`Google API Error: ${msg} ❌\n\nTips:\n- Enable Billing in Google Console\n- Enable Maps SDK for ${Platform.OS === 'android' ? 'Android' : 'iOS'}\n- Check API Key Restrictions`);
      }
    } catch (e) {
      alert('Network Error: Could not reach Google APIs. 🌐');
    }
  };

  const openExternalMaps = () => {
    if (!location) return;
    const { latitude, longitude } = location.coords;
    const url = Platform.select({
      ios: `maps:0,0?q=Nearby Travelers@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(Nearby Travelers)`
    });
    if (url) Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={{ marginTop: 12, color: COLORS.textLight, fontWeight: '600' }}>
          Finding travelers near you...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 44, marginBottom: 20 }}>📍</Text>
        <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 16, marginBottom: 8, textAlign: 'center', paddingHorizontal: 40 }}>
          Location Error
        </Text>
        <Text style={{ color: COLORS.textSecondary, marginBottom: 24, textAlign: 'center', paddingHorizontal: 40 }}>
          {error}
        </Text>
        <View style={{ gap: 12 }}>
          <TouchableOpacity 
            onPress={() => {
              setLoading(true);
              setError(null);
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry Location</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={testGoogleAPI}
            style={[styles.retryBtn, { backgroundColor: '#34495E' }]}
          >
            <Text style={styles.retryText}>Check Maps API Status</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }


  if (!location) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>🗺️</Text>
          <Text style={styles.logoText}>Nearby</Text>
        </View>
      </View>

      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {profiles.map(profile => {
          const profilePhoto = profile.photos?.find((p: any) => p.isProfile)?.url || profile.photos?.[0]?.url;
          return (
            <Marker
              key={profile._id}
              coordinate={{
                latitude: profile.location.coordinates[1],
                longitude: profile.location.coordinates[0],
              }}
            >
              <View style={styles.markerContainer}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.markerImage} />
                ) : (
                  <View style={[styles.markerImage, styles.noPhoto]}>
                     <Text style={{ fontSize: 20 }}>👤</Text>
                  </View>
                )}
              </View>
              <Callout tooltip onPress={() => navigation.navigate('UserDetail', { userId: profile._id })}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutName}>{profile.firstName}{profile.age ? `, ${profile.age}` : ''}</Text>
                  <Text style={styles.calloutBio} numberOfLines={2}>{profile.bio || 'Exploring the world!'}</Text>
                  <Text style={styles.calloutLink}>View Profile ➔</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Action Buttons for Resiliency */}
      <View style={styles.floatingActions}>
         <TouchableOpacity style={styles.fab} onPress={openExternalMaps}>
            <Text style={{ fontSize: 18 }}>🚩</Text>
            <Text style={styles.fabText}>Open Google Maps</Text>
         </TouchableOpacity>
         <TouchableOpacity style={[styles.fab, { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border }]} onPress={testGoogleAPI}>
            <Text style={{ fontSize: 18 }}>🛠️</Text>
            <Text style={[styles.fabText, { color: COLORS.text }]}>Fix Blank Map</Text>
         </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoEmoji: { fontSize: 24 },
  logoText: { fontSize: 22, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  retryBtn: { 
    backgroundColor: COLORS.teal, paddingHorizontal: 32, paddingVertical: 14, 
    borderRadius: 100, ...SHADOW.md 
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  markerContainer: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white,
    padding: 2, ...SHADOW.md,
  },
  markerImage: { width: 40, height: 40, borderRadius: 20 },
  noPhoto: { backgroundColor: COLORS.tealLight, justifyContent: 'center', alignItems: 'center' },
  calloutContainer: { 
    width: 180, padding: 14, backgroundColor: COLORS.white, 
    borderRadius: 20, ...SHADOW.lg, 
  },
  calloutName: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  calloutBio: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 18 },
  calloutLink: { fontSize: 12, color: COLORS.teal, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  floatingActions: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    flexDirection: 'row', gap: 12, justifyContent: 'center'
  },
  fab: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.teal,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.full,
    ...SHADOW.md, gap: 8
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
