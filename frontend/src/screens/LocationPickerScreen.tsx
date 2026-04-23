import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  TextInput, FlatList, ActivityIndicator, 
  Platform, Keyboard, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import { COLORS } from '../utils/theme';
import apiClient from '../api/client';
import { RootStackParamList } from '../types/navigation';

type LocationPickerRouteProp = RouteProp<RootStackParamList, 'LocationPicker'>;

const LocationPickerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<LocationPickerRouteProp>();
  const { onSelect, initialLocation } = route.params;

  const [region, setRegion] = useState({
    latitude: Number(initialLocation?.lat || 20.5937),
    longitude: Number(initialLocation?.lng || 78.9629),
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(initialLocation ? {
    name: 'Initial Location',
    lat: Number(initialLocation.lat),
    lng: Number(initialLocation.lng)
  } : null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!initialLocation) {
      getCurrentLocation();
    }
  }, []);

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    let location = await Location.getCurrentPositionAsync({});
    const newRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 1000);
    handleMapPress({ nativeEvent: { coordinate: location.coords } } as any);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    try {
      const response = await apiClient.get(`/itinerary/location/autocomplete?input=${text}`);
      setSuggestions(response.data.predictions || []);
    } catch (err) {
      console.error('Autocomplete error:', err);
    } finally {
      setSearching(false);
    }
  };

  const selectSuggestion = async (item: any) => {
    Keyboard.dismiss();
    setSearchQuery(item.description);
    setSuggestions([]);
    setLoading(true);

    try {
      const response = await apiClient.get(`/itinerary/location/geocode?address=${encodeURIComponent(item.description)}`);
      
      if (response.data && response.data.location) {
        const { lat, lng } = response.data.location;
        const newRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
        setSelectedLocation({
          name: response.data.name || item.description,
          lat,
          lng
        });
      } else {
        Alert.alert('Error', 'Could not find exact coordinates for this place.');
      }
    } catch (err) {
      console.error('Select suggestion error:', err);
      Alert.alert('Error', 'Failed to retrieve location details.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setRegion(prev => ({ ...prev, latitude, longitude }));
    setSelectedLocation({ name: 'Loading...', lat: latitude, lng: longitude });

    try {
      const response = await apiClient.get(`/itinerary/location/geocode?lat=${latitude}&lng=${longitude}`);
      if (response.data.formattedAddress) {
        setSelectedLocation({
          name: response.data.name || response.data.formattedAddress,
          lat: latitude,
          lng: longitude
        });
        setSearchQuery(response.data.formattedAddress);
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
    }
  };

  const confirmSelection = () => {
    if (selectedLocation) {
      onSelect(selectedLocation);
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header & Search */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search location..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor={COLORS.textLight}
          />
          {searching && <ActivityIndicator size="small" color={COLORS.teal} style={styles.searchLoader} />}
        </View>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onPress={handleMapPress}
        showsUserLocation
        provider={PROVIDER_GOOGLE}
      >
        {selectedLocation && (
          <Marker 
            coordinate={{ latitude: selectedLocation.lat, longitude: selectedLocation.lng }}
            title={selectedLocation.name}
          />
        )}
      </MapView>

      {/* Suggestions List (Moved after MapView to fix Android z-index overlap) */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                <Ionicons name="location-outline" size={20} color={COLORS.teal} />
                <Text style={styles.suggestionText} numberOfLines={1}>{item.description}</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="always"
          />
        </View>
      )}

      {/* Footer Confirm */}
      {selectedLocation && (
        <View style={styles.footer}>
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={24} color={COLORS.teal} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationName} numberOfLines={1}>{selectedLocation.name}</Text>
              <Text style={styles.locationCoords}>{selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.confirmButton} onPress={confirmSelection}>
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: COLORS.white,
  },
  backButton: {
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  searchLoader: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 100,
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionText: {
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  map: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  locationCoords: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: COLORS.teal,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocationPickerScreen;
