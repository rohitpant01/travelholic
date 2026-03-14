import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterHeader from '../../components/RegisterHeader';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';
import { GOOGLE_MAPS_API_KEY } from '../../api/client';

export default function Step4LocationScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [form, setForm] = useState({
    city: '', country: '', hometown: '',
    lastVisitedPlace: '', dreamDestination: '',
    countriesVisited: '',
    latitude: 0, longitude: 0,
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const getGPSLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to use this feature');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      // Reverse geocode using Google Maps API
      // ================================================================
      // GOOGLE MAPS API KEY - update in src/api/client.ts
      // ================================================================
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const components = data.results[0].address_components;
        // Priority for City: locality > administrative_area_level_3 > sublocality_level_1 > administrative_area_level_2
        const city = components.find((c: any) => c.types.includes('locality'))?.long_name || 
                     components.find((c: any) => c.types.includes('administrative_area_level_3'))?.long_name ||
                     components.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name ||
                     components.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name || '';
        
        const country = components.find((c: any) => c.types.includes('country'))?.long_name || '';
        setForm(f => ({ ...f, city, country, latitude, longitude }));
        Alert.alert('Location Found', `📍 ${city}, ${country}\nYour nearby travelers will update!`);
      } else {
        setForm(f => ({ ...f, latitude, longitude }));
        Alert.alert('Success', 'GPS coordinates saved. Enter city/country manually.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get location');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleNext = async () => {
    if (!form.city || !form.country) return Alert.alert('Error', 'Please enter your current city and country');

    setLoading(true);
    try {
      const res = await userAPI.updateProfile({
        city: form.city,
        country: form.country,
        hometown: form.hometown,
        lastVisitedPlace: form.lastVisitedPlace,
        dreamDestination: form.dreamDestination,
        countriesVisited: form.countriesVisited.split(',').map(s => s.trim()).filter(Boolean),
        coordinates: [form.longitude, form.latitude],
        formattedAddress: `${form.city}, ${form.country}`,
        registrationStep: 5,
      });
      dispatch(updateUser(res.data.user));
      navigation.navigate('Register_Step5');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RegisterHeader step={4} totalSteps={7} title="Your Location"
        subtitle="Help travelers find you nearby" onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            Alert.alert('Exit', 'Do you want to exit registration?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: async () => {
                  await AsyncStorage.removeItem('token');
                  await AsyncStorage.removeItem('user');
                  dispatch(logout());
                } 
              }
            ]);
          }
        }} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.gpsBtn} onPress={getGPSLocation} disabled={gpsLoading}>
          <Ionicons name="location" size={20} color={COLORS.white} />
          <Text style={styles.gpsBtnText}>
            {gpsLoading ? 'Getting Location...' : 'Use My GPS Location'}
          </Text>
          {gpsLoading && <ActivityIndicator size="small" color={COLORS.white} style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

        {[
          { key: 'city', label: 'Current City *', placeholder: 'Mumbai', icon: 'business-outline' },
          { key: 'country', label: 'Country *', placeholder: 'India', icon: 'flag-outline' },
          { key: 'hometown', label: 'Hometown', placeholder: 'Pune', icon: 'home-outline' },
          { key: 'lastVisitedPlace', label: 'Last Visited Place', placeholder: 'Goa', icon: 'airplane-outline' },
          { key: 'dreamDestination', label: 'Dream Destination', placeholder: 'Iceland 🌌', icon: 'star-outline' },
          {
            key: 'countriesVisited', label: 'Countries Visited',
            placeholder: 'India, Nepal, Thailand (comma separated)', icon: 'earth-outline'
          },
        ].map(f => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name={f.icon as any} size={18} color={COLORS.textLight} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChangeText={v => update(f.key, v)}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={handleNext} disabled={loading}
        >
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.nextBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={COLORS.white} /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: SPACING.lg, paddingBottom: 40 },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.teal, borderRadius: RADIUS.md,
    paddingVertical: 14, gap: 8, marginBottom: 8,
  },
  gpsBtnText: { color: COLORS.white, fontSize: FONTS.base, fontWeight: '600' },
  field: { marginBottom: 14 },
  label: {
    fontSize: FONTS.xs, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: FONTS.base, color: COLORS.text },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 24 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
});
