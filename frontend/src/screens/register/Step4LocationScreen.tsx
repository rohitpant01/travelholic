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
import KeyboardWrapper from '../../components/KeyboardWrapper';
import CountryPickerModal from '../../components/CountryPickerModal';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { useAppTheme, FONTS, RADIUS, SPACING } from '../../utils/theme';
import { GOOGLE_MAPS_API_KEY } from '../../api/client';

export default function Step4LocationScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [form, setForm] = useState({
    city: '', country: '', hometown: '',
    lastVisitedPlace: '', dreamDestination: '',
    latitude: 0, longitude: 0,
  });
  const [countriesVisited, setCountriesVisited] = useState<string[]>([]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const getGPSLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to use this feature');
        return;
      }

      // Try last known position first
      let loc = await Location.getLastKnownPositionAsync();
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }

      const { latitude, longitude } = loc.coords;

      // 🔥 Reverse geocode using OUR BACKEND Proxy (fixes API Key 403 errors)
      const res = await userAPI.getReverseGeocode(latitude, longitude);
      const data = res.data;

      if (data.success && data.result) {
        const components = data.result.address_components;
        const city = components.find((c: any) => c.types.includes('locality'))?.long_name || 
                     components.find((c: any) => c.types.includes('administrative_area_level_3'))?.long_name ||
                     components.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name ||
                     components.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name || '';
        
        const country = components.find((c: any) => c.types.includes('country'))?.long_name || '';
        setForm(f => ({ ...f, city, country, latitude, longitude }));
        Alert.alert('Location Found', `📍 ${city}, ${country}\nYour nearby travelers list is now updated!`);
      } else {
        setForm(f => ({ ...f, latitude, longitude }));
        Alert.alert('Partially Found', 'GPS coordinates saved, but city name could not be resolved. Please enter it manually.');
      }
    } catch (error: any) {
      console.error('GPS Location error:', error.message);
      Alert.alert('Error', 'Could not determine your location. Please check your GPS settings.');
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
        countriesVisited: countriesVisited,
        coordinates: [form.longitude, form.latitude],
        formattedAddress: `${form.city}, ${form.country}`,
        registrationStep: 6,
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
    <KeyboardWrapper 
      backgroundColor={theme.background} 
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <RegisterHeader
        step={5} totalSteps={8}
        title="Your Location" subtitle="Help us find travelers near you" onBack={() => {
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
      <View style={styles.form}>

        <TouchableOpacity style={styles.gpsBtn} onPress={getGPSLocation} disabled={gpsLoading}>
          <Ionicons name="location" size={20} color={theme.textWhite} />
          <Text style={styles.gpsBtnText}>
            {gpsLoading ? 'Getting Location...' : 'Use My GPS Location'}
          </Text>
          {gpsLoading && <ActivityIndicator size="small" color={theme.textWhite} style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

        {[
          { key: 'city', label: 'Current City *', placeholder: 'Mumbai', icon: 'business-outline' },
          { key: 'country', label: 'Country *', placeholder: 'India', icon: 'flag-outline' },
          { key: 'hometown', label: 'Hometown', placeholder: 'Pune', icon: 'home-outline' },
          { key: 'lastVisitedPlace', label: 'Last Visited Place', placeholder: 'Goa', icon: 'airplane-outline' },
          { key: 'dreamDestination', label: 'Dream Destination', placeholder: 'Iceland 🌌', icon: 'star-outline' },
        ].map(f => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name={f.icon as any} size={18} color={theme.textLight} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChangeText={v => update(f.key, v)}
                placeholderTextColor={theme.textLight}
              />
            </View>
          </View>
        ))}

        {/* Countries Visited — Searchable Picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Countries Visited</Text>
          <TouchableOpacity
            style={[styles.inputWrapper, { minHeight: 48 }]}
            onPress={() => setShowCountryPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="earth-outline" size={18} color={theme.textLight} style={styles.icon} />
            {countriesVisited.length > 0 ? (
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {countriesVisited.map(c => (
                  <View key={c} style={{ backgroundColor: theme.teal + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, color: theme.teal, fontWeight: '600' }}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ flex: 1, color: theme.textLight, fontSize: FONTS.base }}>Tap to select countries</Text>
            )}
            <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
          </TouchableOpacity>
        </View>

        <CountryPickerModal
          visible={showCountryPicker}
          onClose={() => setShowCountryPicker(false)}
          selected={countriesVisited}
          onDone={setCountriesVisited}
        />

        <TouchableOpacity
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={handleNext} disabled={loading}
        >
          <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.nextBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={theme.textWhite} /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.textWhite} />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardWrapper>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  form: { padding: SPACING.lg, paddingBottom: 40 },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.teal, borderRadius: RADIUS.md,
    paddingVertical: 14, gap: 8, marginBottom: 8,
  },
  gpsBtnText: { color: theme.textWhite, fontSize: FONTS.base, fontWeight: '600' },
  field: { marginBottom: 14 },
  label: {
    fontSize: FONTS.xs, fontWeight: '700', color: theme.textSecondary,
    marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: theme.border,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: FONTS.base, color: theme.text },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 24 },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: theme.textWhite, fontSize: FONTS.lg, fontWeight: '700' },
});
