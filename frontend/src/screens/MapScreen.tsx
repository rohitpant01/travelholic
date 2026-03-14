import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Image, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { discoverAPI } from '../api/services';
import { COLORS, FONTS, SHADOW } from '../utils/theme';

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      
      setLocation(loc);

      try {
        const { latitude, longitude } = loc.coords;
        const res = await discoverAPI.getProfiles(latitude, longitude);
        const validProfiles = res.data.profiles.filter(
          (p: any) => p.location?.coordinates && p.location.coordinates.length === 2 && p.location.coordinates[0] !== 0
        );
        setProfiles(validProfiles);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>🗺️</Text>
          <Text style={styles.logoText}>Nearby</Text>
        </View>
      </View>

      <MapView
        style={styles.map}
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
                  <Text style={styles.calloutName}>{profile.firstName} {profile.age ? `, ${profile.age}` : ''}</Text>
                  <Text style={styles.calloutBio} numberOfLines={2}>{profile.bio || 'Exploring the world!'}</Text>
                  <Text style={styles.calloutLink}>View Profile ➔</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
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
  logoText: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  markerContainer: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white,
    padding: 2, ...SHADOW.md,
  },
  markerImage: { width: 40, height: 40, borderRadius: 20 },
  noPhoto: { backgroundColor: COLORS.tealLight, justifyContent: 'center', alignItems: 'center' },
  calloutContainer: { 
    width: 160, padding: 12, backgroundColor: COLORS.white, 
    borderRadius: 16, ...SHADOW.lg, 
  },
  calloutName: { fontSize: FONTS.base, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  calloutBio: { fontSize: FONTS.xs, color: COLORS.textSecondary, marginBottom: 8 },
  calloutLink: { fontSize: FONTS.xs, color: COLORS.teal, fontWeight: '700', textAlign: 'center' }
});
