import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Platform, Alert, ActivityIndicator, Image, ScrollView
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';
import storage from '../utils/storage';
import { useAppTheme, FONTS, RADIUS, SPACING, SHADOW } from '../utils/theme';
import { authAPI, userAPI, aiAPI } from '../api/services';
import CountryPickerModal from '../components/CountryPickerModal';
import { Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');
import apiClient, { GOOGLE_MAPS_API_KEY } from '../api/client';

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [countriesVisited, setCountriesVisited] = useState<string[]>(user?.countriesVisited || []);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const refreshProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      const freshUser = response.data.user;
      if (freshUser) {
        dispatch(updateUser(freshUser));
        await storage.setItem('user', freshUser);
        
        // Sync local states if they are still at initial empty values
        if (!firstName) setFirstName(freshUser.firstName || '');
        if (!lastName) setLastName(freshUser.lastName || '');
        if (!bio) setBio(freshUser.bio || '');
        if (!city && !country) {
          setCity(freshUser.city || freshUser.location?.city || '');
          setCountry(freshUser.country || freshUser.location?.country || '');
        }
        if (photos.length === 0) setPhotos(freshUser.photos || []);
        if (!originCity) {
          setOriginCity(freshUser.origin?.city || '');
          setOriginCoords(freshUser.origin?.location?.coordinates || [0, 0]);
        }
        if (!destinationCity) {
          setDestinationCity(freshUser.destination?.city || '');
          setDestinationCoords(freshUser.destination?.location?.coordinates || [0, 0]);
        }
        if (!travelDate) setTravelDate(freshUser.travelDate ? new Date(freshUser.travelDate).toISOString().split('T')[0] : '');
        if (countriesVisited.length === 0) setCountriesVisited(freshUser.countriesVisited || []);
      }
    } catch (error) {
      console.warn('[EditProfileScreen] Refresh failed:', error);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);
  
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
        travelDate: travelDate || undefined,
        countriesVisited: countriesVisited
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
      const res = await aiAPI.autocomplete(text);
      const data = res.data;
      
      if (data.status === 'OK') {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      } else {
        if (data.status !== 'ZERO_RESULTS') {
          console.warn(`[Google Autocomplete Error] Status: ${data.status}`);
          console.warn(`[Google Autocomplete Error] Message: ${data.error_message || 'N/A'}`);
        }
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const selectSuggestion = async (item: any) => {
    try {
      const res = await apiClient.get('/itinerary/location/geocode', { params: { address: item.description } });
      const geoData = res.data;

      if (geoData.location) {
        const cityVal = item.structured_formatting?.main_text || item.description.split(',')[0];
        const parts = item.description.split(',');
        const countryVal = parts.length > 1 ? parts[parts.length - 1].trim() : '';
        
        const lat = geoData.location.lat;
        const lng = geoData.location.lng;

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
      } else {
        console.warn(`[Geocode Error] No location data returned`);
      }
    } catch (e) {
      console.error('Error fetching place details:', e);
      const fallbackText = item.structured_formatting?.main_text || item.description?.split(',')[0] || '';
      if (activeField === 'city') setCity(fallbackText);
      else if (activeField === 'origin') setOriginCity(fallbackText);
      else if (activeField === 'destination') setDestinationCity(fallbackText);
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
    <KeyboardWrapper 
      backgroundColor={theme.white}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={theme.teal} /> : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
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
                          <Ionicons name="star" size={14} color={theme.white} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.photoActionBtn, { backgroundColor: theme.error }]} onPress={() => handleDeletePhoto(photo._id)}>
                        <Ionicons name="trash" size={14} color={theme.white} />
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
                    {uploading ? <ActivityIndicator size="small" color={theme.teal} /> : (
                      <Ionicons name="add" size={24} color={theme.textSecondary} />
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
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          {/* Email Management Section */}
          <View style={styles.emailContainer}>
            <View style={styles.emailHeader}>
              <Text style={styles.label}>Email Address</Text>
              {user?.isEmailVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.teal} />
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
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {user?.authProvider === 'local' && (
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter Current Password"
                    placeholderTextColor={theme.textSecondary}
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
                    {emailLoading ? <ActivityIndicator size="small" color={theme.white} /> : (
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
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          <View style={[styles.row, { zIndex: activeField === 'city' && showSuggestions ? 9999 : 1 }]}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8, zIndex: 999 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={(t) => fetchSuggestions(t, 'city')}
                placeholder="City"
                placeholderTextColor={theme.textSecondary}
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
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Countries Visited</Text>
            <TouchableOpacity 
              style={[styles.input, { minHeight: 48, justifyContent: 'center' }]}
              onPress={() => setShowCountryPicker(true)}
            >
              {countriesVisited.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 }}>
                  {countriesVisited.map(c => (
                    <View key={c} style={{ backgroundColor: theme.teal + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, color: theme.teal, fontWeight: '600' }}>{c}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: theme.textSecondary }}>Select countries you've visited</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Travel Matching Section */}
        <View style={[styles.infoSection, { zIndex: (activeField === 'origin' || activeField === 'destination') && showSuggestions ? 9999 : 1 }]}>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Travel Plan</Text>
          
          <View style={[styles.inputGroup, { zIndex: activeField === 'origin' && showSuggestions ? 999 : 1 }]}>
            <Text style={styles.label}>Departure City (Origin)</Text>
            <TextInput
              style={styles.input}
              value={originCity}
              onChangeText={(t) => fetchSuggestions(t, 'origin')}
              placeholder="Where are you starting from?"
              placeholderTextColor={theme.textSecondary}
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

          <View style={[styles.inputGroup, { zIndex: activeField === 'destination' && showSuggestions ? 999 : 1 }]}>
            <Text style={styles.label}>Destination City</Text>
            <TextInput
              style={styles.input}
              value={destinationCity}
              onChangeText={(t) => fetchSuggestions(t, 'destination')}
              placeholder="Where are you going?"
              placeholderTextColor={theme.textSecondary}
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
            <Text style={styles.label}>Travel Date</Text>
            <TouchableOpacity 
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: travelDate ? theme.text : theme.textSecondary }}>
                {travelDate || 'Select travel date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={travelDate ? new Date(travelDate) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  setShowDatePicker(false);
                  if (date) {
                    setTravelDate(date.toISOString().split('T')[0]);
                  }
                }}
              />
            )}
          </View>
        </View>

        <CountryPickerModal
          visible={showCountryPicker}
          onClose={() => setShowCountryPicker(false)}
          selected={countriesVisited}
          onDone={setCountriesVisited}
        />

        <View style={{ height: 40 }} />
      </View>
    </KeyboardWrapper>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: theme.white,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: theme.teal },
  content: { flex: 1, backgroundColor: theme.background, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  photoSlot: {
    width: (W - 60) / 3, aspectRatio: 3 / 4, borderRadius: RADIUS.md,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    overflow: 'hidden', position: 'relative'
  },
  photoSlotProfile: { borderColor: theme.teal, borderWidth: 2 },
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
    backgroundColor: theme.teal, paddingVertical: 2, alignItems: 'center'
  },
  profileTagText: { color: theme.white, fontSize: 10, fontWeight: '700' },
  infoSection: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  input: {
    backgroundColor: theme.card, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 16, color: theme.text,
    borderWidth: 1, borderColor: theme.border
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', zIndex: 100 },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: theme.border,
    zIndex: 1000,
    marginTop: 4,
    ...SHADOW.md,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.text,
  },
  // Email management styles
  emailContainer: {
    backgroundColor: theme.card, padding: 16, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: theme.border, marginVertical: 8
  },
  emailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: theme.teal, fontSize: 12, fontWeight: '700' },
  verifyNowText: { color: theme.error, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  emailDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emailValue: { fontSize: 16, color: theme.text, fontWeight: '500' },
  changeBtnText: { color: theme.teal, fontWeight: '700', fontSize: 14 },
  changeEmailBox: { gap: 8 },
  changeEmailActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 12 },
  cancelLink: { paddingHorizontal: 4 },
  cancelText: { color: theme.textSecondary, fontSize: 14 },
  confirmSmallBtn: { backgroundColor: theme.teal, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  confirmSmallBtnText: { color: theme.white, fontWeight: '700', fontSize: 14 },
});
