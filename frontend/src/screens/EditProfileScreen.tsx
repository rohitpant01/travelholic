import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Image, Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootState } from '../store';
import { userAPI } from '../api/services';
import { updateUser } from '../store/slices/authSlice';
import { COLORS, FONTS, RADIUS, SPACING, SHADOW } from '../utils/theme';
import { Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');
import { GOOGLE_MAPS_API_KEY } from '../api/client';

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || user?.location?.city || '');
  const [country, setCountry] = useState(user?.country || user?.location?.country || '');
  const [coordinates, setCoordinates] = useState<number[]>(user?.location?.coordinates || [0, 0]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [photos, setPhotos] = useState<any[]>(user?.photos || []);

  // Travel Matching states
  const [originCity, setOriginCity] = useState(user?.origin?.city || '');
  const [originCoords, setOriginCoords] = useState<number[]>(user?.origin?.location?.coordinates || [0, 0]);
  const [destinationCity, setDestinationCity] = useState(user?.destination?.city || '');
  const [destinationCoords, setDestinationCoords] = useState<number[]>(user?.destination?.location?.coordinates || [0, 0]);
  const [travelDate, setTravelDate] = useState(user?.travelDate ? new Date(user.travelDate).toISOString().split('T')[0] : '');
  
  const [activeField, setActiveField] = useState<'city' | 'origin' | 'destination'>('city');
  
  // Email management states
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleChangeEmail = async () => {
    if (!email || !email.includes('@')) return Alert.alert('Error', 'Valid email required');
    if (user?.authProvider === 'local' && !password) return Alert.alert('Error', 'Password required to change email');

    setEmailLoading(true);
    try {
      const res = await authAPI.changeEmail(email, password);
      dispatch(updateUser(res.data.user));
      Alert.alert('Email Updated', 'Verification code sent to your new email. Please verify to continue.', [
        { text: 'OK' }
      ]);
      // Note: App.tsx will automatically redirect to verification screen because isEmailVerified is now false
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update email');
    } finally {
      setEmailLoading(false);
      setIsChangingEmail(false);
      setPassword('');
    }
  };

  const verifyNow = async () => {
    try {
      await authAPI.sendEmailOTP(user?.email, user?._id);
      dispatch(updateUser({ isEmailVerified: false })); // Ensure state triggers redirect
      Alert.alert('Code Sent', 'Check your inbox for the verification code.');
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code');
    }
  };

  const handleSave = async () => {
    if (!firstName || !lastName) return Alert.alert('Error', 'Name is required');
    if (!city.trim()) return Alert.alert('Error', 'City is required');
    if (!country.trim()) return Alert.alert('Error', 'Country is required');
    
    setLoading(true);
    try {
      const res = await userAPI.updateProfile({
        firstName,
        lastName,
        bio,
        city,
        country,
        coordinates,
        origin: { 
          city: originCity, 
          location: { type: 'Point', coordinates: originCoords } 
        },
        destination: { 
          city: destinationCity, 
          location: { type: 'Point', coordinates: destinationCoords } 
        },
        travelDate: travelDate || undefined
      });
      dispatch(updateUser(res.data.user));
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (text: string, field: 'city' | 'origin' | 'destination' = 'city') => {
    setActiveField(field);
    if (field === 'city') setCity(text);
    else if (field === 'origin') setOriginCity(text);
    else if (field === 'destination') setDestinationCity(text);

    if (text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=(cities)&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK') {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      } else if (data.status === 'REQUEST_DENIED') {
        console.warn('Google Places API Request Denied:', data.error_message);
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const selectSuggestion = async (item: any) => {
    try {
      // Get Details for city/country breakdown and coordinates
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=address_components,geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK') {
        const comps = data.result.address_components;
        const cityVal = comps.find((c: any) => c.types.includes('locality'))?.long_name || 
                        comps.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name || 
                        item.description.split(',')[0];
        const countryVal = comps.find((c: any) => c.types.includes('country'))?.long_name || '';
        
        const lat = data.result.geometry.location.lat;
        const lng = data.result.geometry.location.lng;

        if (activeField === 'city') {
          setCity(cityVal);
          setCountry(countryVal);
          setCoordinates([lng, lat]);
        } else if (activeField === 'origin') {
          setOriginCity(cityVal);
          setOriginCoords([lng, lat]);
        } else if (activeField === 'destination') {
          setDestinationCity(cityVal);
          setDestinationCoords([lng, lat]);
        }
      }
    } catch (e) {
      console.error('Error fetching place details:', e);
      if (activeField === 'city') setCity(item.structured_formatting.main_text);
      else if (activeField === 'origin') setOriginCity(item.structured_formatting.main_text);
      else if (activeField === 'destination') setDestinationCity(item.structured_formatting.main_text);
    } finally {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const pickImage = async () => {
    if (photos.length >= 6) return Alert.alert('Limit Reached', 'Maximum 6 photos allowed');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Allow photo access to upload photos');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      
      // 1. Clean the path (remove query params for extension detection)
      const cleanPath = uri.split('?')[0];
      const extension = cleanPath.split('.').pop()?.toLowerCase() || 'jpg';
      
      // 2. Standardize MIME (strict mapping)
      const type = extension === 'png' ? 'image/png' : 'image/jpeg';
      
      // 3. Simple filename (avoid special chars)
      const name = `image_${Date.now()}.${extension}`;

      // 4. URI must start with file:// for most Android/Expo environments
      const finalUri = Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri;

      formData.append('photos', {
        uri: finalUri,
        name: name,
        type: type,
      } as any);

      const res = await userAPI.uploadPhotos(formData);
      setPhotos(res.data.photos);
      dispatch(updateUser({ photos: res.data.photos }));
    } catch (error: any) {
      console.error('PHOTO UPLOAD ERROR:', error);
      let msg = 'Could not upload photo';
      if (error.response?.data?.error) {
        msg = error.response.data.error;
      } else if (error.message) {
        msg = `${error.message}${error.code ? ` (${error.code})` : ''}`;
      }
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (photos.length <= 1) return Alert.alert('Error', 'At least one photo is required');

    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await userAPI.deletePhoto(photoId);
            setPhotos(res.data.photos);
            dispatch(updateUser({ photos: res.data.photos }));
          } catch (error: any) {
            Alert.alert('Error', 'Failed to delete photo');
          }
        }
      }
    ]);
  };

  const handleSetProfilePhoto = async (photoId: string) => {
    try {
      const res = await userAPI.setProfilePhoto(photoId);
      setPhotos(res.data.photos);
      dispatch(updateUser({ photos: res.data.photos }));
    } catch (error: any) {
      Alert.alert('Error', 'Failed to set profile photo');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={COLORS.teal} /> : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Photo Management Section */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <View style={styles.photoGrid}>
          {Array.from({ length: 6 }).map((_, index) => {
            const photo = photos[index];
            return (
              <View 
                key={photo?._id || photo?.publicId || index} 
                style={[styles.photoSlot, photo?.isProfile && styles.photoSlotProfile]}
              >
                {photo ? (
                  <>
                    <Image source={{ uri: photo.url }} style={styles.photo} />
                    <View style={styles.photoActions}>
                      {!photo.isProfile && (
                        <TouchableOpacity style={styles.photoActionBtn} onPress={() => handleSetProfilePhoto(photo._id)}>
                          <Ionicons name="star" size={14} color={COLORS.white} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: COLORS.error }]} onPress={() => handleDeletePhoto(photo._id)}>
                        <Ionicons name="trash" size={14} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                    {photo.isProfile && (
                      <View style={styles.profileTag}>
                        <Text style={styles.profileTagText}>Primary</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <TouchableOpacity 
                    style={styles.addPhotoBtn} 
                    onPress={pickImage}
                    disabled={uploading}
                  >
                    {uploading ? <ActivityIndicator size="small" color={COLORS.teal} /> : (
                      <Ionicons name="add" size={24} color={COLORS.textLight} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter first name"
            />
          </View>

          {/* Email Management Section */}
          <View style={styles.emailContainer}>
            <View style={styles.emailHeader}>
              <Text style={styles.label}>Email Address</Text>
              {user?.isEmailVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.teal} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={verifyNow}>
                  <Text style={styles.verifyNowText}>Verify Now</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {!isChangingEmail ? (
              <View style={styles.emailDisplay}>
                <Text style={styles.emailValue}>{user?.email}</Text>
                <TouchableOpacity onPress={() => setIsChangingEmail(true)}>
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.changeEmailBox}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="New Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {user?.authProvider === 'local' && (
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter Current Password"
                    secureTextEntry
                  />
                )}
                <View style={styles.changeEmailActions}>
                  <TouchableOpacity onPress={() => setIsChangingEmail(false)} style={styles.cancelLink}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleChangeEmail} 
                    style={styles.confirmSmallBtn}
                    disabled={emailLoading}
                  >
                    {emailLoading ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                      <Text style={styles.confirmSmallBtnText}>Update & Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={(t) => fetchSuggestions(t, 'city')}
                placeholder="City"
                onFocus={() => {
                  setActiveField('city');
                  if (city.length >= 3) setShowSuggestions(true);
                }}
              />
              {showSuggestions && activeField === 'city' && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
                    {suggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => selectSuggestion(item)}
                      >
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Country</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder="Country"
              />
            </View>
          </View>

          {/* Travel Matching Section */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Travel Plan</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Departure City (Origin)</Text>
            <TextInput
              style={styles.input}
              value={originCity}
              onChangeText={(t) => fetchSuggestions(t, 'origin')}
              placeholder="Where are you starting from?"
              onFocus={() => {
                setActiveField('origin');
                if (originCity.length >= 3) setShowSuggestions(true);
              }}
            />
            {showSuggestions && activeField === 'origin' && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
                  {suggestions.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => selectSuggestion(item)}
                    >
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Destination City</Text>
            <TextInput
              style={styles.input}
              value={destinationCity}
              onChangeText={(t) => fetchSuggestions(t, 'destination')}
              placeholder="Where are you going?"
              onFocus={() => {
                setActiveField('destination');
                if (destinationCity.length >= 3) setShowSuggestions(true);
              }}
            />
            {showSuggestions && activeField === 'destination' && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
                  {suggestions.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => selectSuggestion(item)}
                    >
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Travel Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={travelDate}
              onChangeText={setTravelDate}
              placeholder="e.g. 2024-12-25"
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.teal },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  photoSlot: {
    width: (W - 60) / 3, aspectRatio: 3 / 4, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', position: 'relative'
  },
  photoSlotProfile: { borderColor: COLORS.teal, borderWidth: 2 },
  photo: { width: '100%', height: '100%' },
  addPhotoBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoActions: {
    position: 'absolute', bottom: 4, right: 4, flexDirection: 'row', gap: 4
  },
  photoActionBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center'
  },
  profileTag: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: COLORS.teal, paddingVertical: 2, alignItems: 'center'
  },
  profileTagText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  infoSection: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  input: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 16, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  row: { flexDirection: 'row', zIndex: 100 },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 1000,
    marginTop: 4,
    ...SHADOW.md,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  // Email management styles
  emailContainer: {
    backgroundColor: '#F8FAFC', padding: 16, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: '#E2E8F0', marginVertical: 8
  },
  emailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: COLORS.teal, fontSize: 12, fontWeight: '700' },
  verifyNowText: { color: COLORS.error, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  emailDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emailValue: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  changeBtnText: { color: COLORS.teal, fontWeight: '700', fontSize: 14 },
  changeEmailBox: { gap: 8 },
  changeEmailActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 12 },
  cancelLink: { paddingHorizontal: 4 },
  cancelText: { color: COLORS.textSecondary, fontSize: 14 },
  confirmSmallBtn: { backgroundColor: COLORS.teal, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  confirmSmallBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});
