import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Image, Text, Platform, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW, RADIUS, useAppTheme } from '../utils/theme';

const { width, height } = Dimensions.get('window');

interface TravelersMapViewProps {
  profiles: any[];
  userLocation: { latitude: number; longitude: number } | null;
  onMarkerPress: (user: any) => void;
  selectedUserId?: string;
}

export default function TravelersMapView({ 
  profiles, 
  userLocation, 
  onMarkerPress,
  selectedUserId 
}: TravelersMapViewProps) {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const mapRef = useRef<MapView>(null);
  
  const [initialRegionSet, setInitialRegionSet] = useState(false);

  useEffect(() => {
    if (userLocation && !initialRegionSet && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }, 1000);
      setInitialRegionSet(true);
    }
  }, [userLocation]);

  // Focus on selected user if changed from outside
  useEffect(() => {
    if (selectedUserId && mapRef.current) {
      const selectedTraveler = profiles.find(p => p._id === selectedUserId);
      if (selectedTraveler && selectedTraveler.location?.coordinates) {
        mapRef.current.animateToRegion({
          latitude: selectedTraveler.location.coordinates[1],
          longitude: selectedTraveler.location.coordinates[0],
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 800);
      }
    }
  }, [selectedUserId]);

  const validProfiles = profiles.filter(
    p => p.location?.coordinates && p.location.coordinates.length === 2 && p.location.coordinates[0] !== 0
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={true}
        showsMyLocationButton={false} // We can make a custom one
        customMapStyle={theme.mode === 'dark' ? darkMapStyle : []}
      >
        {validProfiles.map(profile => {
          const profilePhoto = profile.photos?.find((p: any) => p.isProfile)?.url || profile.photos?.[0]?.url;
          const isSelected = profile._id === selectedUserId;

          return (
            <Marker
              key={profile._id}
              coordinate={{
                latitude: profile.location.coordinates[1],
                longitude: profile.location.coordinates[0],
              }}
              onPress={() => onMarkerPress(profile)}
              tracksViewChanges={false} // Performance optimization
            >
              <View style={[
                styles.markerWrapper,
                isSelected && styles.markerWrapperSelected
              ]}>
                <View style={[
                  styles.markerContainer,
                  isSelected && styles.markerContainerSelected
                ]}>
                  {profilePhoto ? (
                    <Image source={{ uri: profilePhoto }} style={styles.markerImage} />
                  ) : (
                    <View style={[styles.markerImage, styles.noPhoto]}>
                      <Text style={{ fontSize: 16 }}>👤</Text>
                    </View>
                  )}
                </View>
                {isSelected && (
                  <View style={styles.pulsar} />
                )}
                <View style={[styles.pointer, isSelected && styles.pointerSelected]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <TouchableOpacity 
        style={styles.myLocationBtn} 
        onPress={() => {
          if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            });
          }
        }}
      >
        <Ionicons name="navigate" size={24} color={theme.teal} />
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  markerWrapperSelected: {
    transform: [{ scale: 1.2 }],
  },
  markerContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.card,
    padding: 3,
    ...SHADOW.md,
    borderWidth: 2,
    borderColor: theme.white,
    zIndex: 2,
  },
  markerContainerSelected: {
    borderColor: theme.teal,
    borderWidth: 3,
  },
  markerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  noPhoto: {
    backgroundColor: theme.tealLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointer: {
    width: 10,
    height: 10,
    backgroundColor: theme.white,
    transform: [{ rotate: '45deg' }],
    marginTop: -6,
    zIndex: 1,
    ...SHADOW.sm,
  },
  pointerSelected: {
    backgroundColor: theme.teal,
  },
  pulsar: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.teal,
    opacity: 0.4,
    zIndex: 0,
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.lg,
  },
});

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38413e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];
