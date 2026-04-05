import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Image, Alert, Dimensions, Modal, TextInput, ActivityIndicator,
  Platform, PanResponder, RefreshControl
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState } from '../store';
import { logout, setUser } from '../store/slices/authSlice';
import { userAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { GOOGLE_MAPS_API_KEY } from '../api/client';

const { width: W } = Dimensions.get('window');

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const { user } = useSelector((s: RootState) => s.auth);
  const { mode } = useSelector((s: RootState) => s.theme);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [submittingTrip, setSubmittingTrip] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tripForm, setTripForm] = useState({
    _id: '',
    origin: '',
    destination: '',
    startDate: '',
    endDate: '',
    details: ''
  });
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<'origin' | 'destination'>('origin');
  const [refreshing, setRefreshing] = useState(false);

  const refreshProfile = async () => {
    try {
      setRefreshing(true);
      const response = await userAPI.getProfile();
      if (response.data.user) {
        dispatch(setUser(response.data.user));
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      }
    } catch (error) {
      console.warn('[ProfileScreen] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      refreshProfile();
    }, [])
  );

  const fetchSuggestions = async (text: string, field: 'origin' | 'destination') => {
    setActiveField(field);
    setTripForm(f => ({ ...f, [field]: text }));

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
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const selectSuggestion = async (item: any) => {
    const cityVal = item.structured_formatting.main_text || item.description.split(',')[0];
    setTripForm(f => ({ ...f, [activeField]: cityVal }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAddTrip = async () => {
    if (!tripForm.origin || !tripForm.destination || !tripForm.startDate || !tripForm.endDate) {
      Alert.alert('Error', 'Please fill in all mandatory fields (Origin, Destination, Start Date, End Date)');
      return;
    }

    if (new Date(tripForm.startDate) > new Date(tripForm.endDate)) {
      Alert.alert('Invalid Dates', 'Start date cannot be after the end date.');
      return;
    }

    setSubmittingTrip(true);
    try {
      const payload = {
        origin: { city: tripForm.origin },
        destination: { city: tripForm.destination },
        startDate: tripForm.startDate,
        endDate: tripForm.endDate,
        details: tripForm.details
      };

      let res;
      if (isEditingTrip && tripForm._id) {
        res = await userAPI.updateCompletedTrip(tripForm._id, payload);
      } else {
        res = await userAPI.addCompletedTrip(payload);
      }

      if (res.data) {
        dispatch(setUser({ ...user!, completedTrips: res.data.trips }));
        setShowAddTrip(false);
        resetTripForm();
        Alert.alert('Success', isEditingTrip ? 'Trip updated!' : 'Trip added to your timeline!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save trip');
    } finally {
      setSubmittingTrip(false);
    }
  };

  const handleDeleteTrip = (tripId: string) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await userAPI.deleteCompletedTrip(tripId);
              dispatch(setUser({ ...user!, completedTrips: res.data.trips }));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete trip');
            }
          }
        }
      ]
    );
  };

  const openEditTrip = (trip: any) => {
    setTripForm({
      _id: trip._id,
      origin: trip.origin.city,
      destination: trip.destination.city,
      startDate: trip.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : '',
      endDate: trip.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : '',
      details: trip.details || ''
    });
    setIsEditingTrip(true);
    setShowAddTrip(true);
  };

  const resetTripForm = () => {
    setTripForm({ _id: '', origin: '', destination: '', startDate: '', endDate: '', details: '' });
    setIsEditingTrip(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          dispatch(logout());
        },
      },
    ]);
  };

  const profilePhoto = user?.photos?.find(p => p.isProfile)?.url || user?.photos?.[0]?.url;
  const photos = user?.photos || [];
  const interests = user?.interests || [];
  const languages = user?.languages || [];
  const lookingFor = user?.lookingFor || [];

  const INTEREST_EMOJIS: Record<string, string> = {
    Mountains: '🏔️', Beaches: '🏖️', 'Road Trips': '🚗', Trekking: '🥾',
    Camping: '⛺', Photography: '📸', 'Food Travel': '🍜', 'Cultural Travel': '🏛️',
    'Adventure Sports': '🪂', Backpacking: '🎒', 'Solo Travel': '🧍', Cruises: '🚢',
  };

  return (
    <KeyboardAwareScrollView 
      style={styles.container} 
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      enableOnAndroid={true}
      extraScrollHeight={20}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshProfile} colors={[theme.teal]} tintColor={theme.teal} />
      }
    >
      {/* Hero photo section */}
      <View style={styles.heroContainer}>
        {profilePhoto ? (
          <Image source={{ uri: photos[activePhotoIndex]?.url || profilePhoto }} style={styles.heroPhoto} />
        ) : (
          <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.heroPhoto}>
            <Text style={{ fontSize: 80 }}>✈️</Text>
          </LinearGradient>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.heroOverlay} />

        {/* Photo navigation tap zones */}
        <TouchableOpacity
          style={styles.prevPhotoZone}
          onPress={() => setActivePhotoIndex(i => Math.max(0, i - 1))}
        />
        <TouchableOpacity
          style={styles.nextPhotoZone}
          onPress={() => setActivePhotoIndex(i => Math.min(photos.length - 1, i + 1))}
        />

        {/* Photo dots */}
        {photos.length > 1 && (
          <View style={styles.photoDots}>
            {photos.map((_: any, i: number) => (
              <TouchableOpacity key={i} onPress={() => setActivePhotoIndex(i)}>
                <View style={[styles.photoDot, activePhotoIndex === i && styles.photoDotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.editPhotoBtn}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Ionicons name="pencil" size={18} color={theme.textWhite} />
        </TouchableOpacity>

        {/* Name + verified */}
        <View style={styles.heroInfo}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>
              {user?.firstName} {user?.lastName}
            </Text>
            {user?.isPhotoVerified && (
              <Ionicons name="checkmark-circle" size={22} color={theme.teal} />
            )}
          </View>
          <Text style={styles.heroAge}>
            {user?.age ? `${user.age} · ` : ''}{user?.gender || ''}
          </Text>
          <View style={styles.heroLocation}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroLocationText}>
              {user?.location?.city || user?.city || 'Unknown'}
              {(user?.location?.city || user?.city) && (user?.location?.country || user?.country) ? ', ' : ''}
              {user?.location?.country || user?.country || ''}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Stats row ── */}
      {/* ✅ The Likes stat is now a TouchableOpacity that opens WhoLikedMe.   */}
      {/* All other stats remain plain Views.                                  */}
      <View style={styles.statsRow}>

        {/* Likes — tappable */}
        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('WhoLikedMe')}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{user?.likesReceived || 0}</Text>
          <View style={styles.statLabelRow}>
            <Text style={[styles.statLabel, styles.statLabelTeal]}>Likes</Text>
            <Ionicons name="chevron-forward" size={11} color={theme.teal} />
          </View>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        {/* Matches — tappable */}
        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('MyMatches')}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{user?.matchesCount || 0}</Text>
          <View style={styles.statLabelRow}>
            <Text style={[styles.statLabel, styles.statLabelTeal]}>Matches</Text>
            <Ionicons name="chevron-forward" size={11} color={theme.teal} />
          </View>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <View style={styles.stat}>
          <Text style={styles.statNumber}>{user?.completedTrips?.length || 0}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.stat}>
          <Text style={styles.statNumber}>{user?.countriesVisited?.length || 0}</Text>
          <Text style={styles.statLabel}>Countries</Text>
        </View>

      </View>

      {/* ── Email Verification Banner ── */}
      {!user?.isEmailVerified && (user?.registrationStep || 0) >= 9 && (
        <TouchableOpacity 
          style={styles.verifyBanner} 
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <LinearGradient 
            colors={[mode === 'dark' ? '#2C1D1D' : '#FFF5F5', mode === 'dark' ? '#201515' : '#FFF0F0']} 
            style={[styles.verifyBannerGrad, { borderColor: theme.error + '40', borderWidth: 1 }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <View style={[styles.verifyIconBG, { backgroundColor: mode === 'dark' ? '#3D1C1C' : '#FFEEED' }]}>
              <Ionicons name="mail-unread-outline" size={24} color={theme.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyTitle, { color: theme.error }]}>Verify Your Email</Text>
              <Text style={styles.verifySubtitle}>Complete verification in Edit Profile 📧</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.error} />
          </LinearGradient>
        </TouchableOpacity>
      )}
      
      {/* ── Verification Banner ── */}
      {!user?.isPhotoVerified && (
        <TouchableOpacity 
          style={styles.verifyBanner} 
          onPress={() => navigation.navigate('Verification')}
          activeOpacity={0.8}
        >
          <LinearGradient 
            colors={[theme.tealLight, mode === 'dark' ? '#1E293B' : '#F0FFFF']} 
            style={styles.verifyBannerGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <View style={styles.verifyIconBG}>
              <Ionicons name="shield-checkmark" size={24} color={theme.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>Verify Your Identity</Text>
              <Text style={styles.verifySubtitle}>Get the blue badge & build trust ✨</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.teal} />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Bio */}
      {user?.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Me</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>
      ) : null}

      {/* Interests */}
      {interests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel Interests</Text>
          <View style={styles.chipRow}>
            {interests.map(i => (
              <View key={i} style={styles.interestChip}>
                <Text style={styles.interestEmoji}>{INTEREST_EMOJIS[i] || '✈️'}</Text>
                <Text style={styles.interestLabel}>{i}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Languages</Text>
          <View style={styles.chipRow}>
            {languages.map(l => (
              <View key={l} style={styles.langChip}>
                <Text style={styles.langLabel}>🗣️ {l}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Looking For */}
      {lookingFor.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking For</Text>
          <View style={styles.chipRow}>
            {lookingFor.map(l => (
              <View key={l} style={styles.lookingChip}>
                <Text style={styles.lookingLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Travel History */}
      {(user?.countriesVisited?.length || user?.dreamDestination) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel History</Text>
          {user?.lastVisitedPlace && (
            <View style={styles.travelRow}>
              <Ionicons name="airplane" size={16} color={theme.teal} />
              <Text style={styles.travelText}>Last visited: <Text style={styles.travelValue}>{user.lastVisitedPlace}</Text></Text>
            </View>
          )}
          {user?.dreamDestination && (
            <View style={styles.travelRow}>
              <Ionicons name="star" size={16} color={theme.gold} />
              <Text style={styles.travelText}>Dream destination: <Text style={styles.travelValue}>{user.dreamDestination}</Text></Text>
            </View>
          )}
          {user?.countriesVisited && user.countriesVisited.length > 0 && (
            <View style={styles.travelRow}>
              <Ionicons name="earth" size={16} color={theme.orange} />
              <Text style={styles.travelText}>
                Visited: <Text style={styles.travelValue}>{user.countriesVisited.join(', ')}</Text>
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Add Trip Modal */}
      <Modal
        visible={showAddTrip}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddTrip(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={{ flex: 1 }} 
            onPress={() => setShowAddTrip(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Document a Trip</Text>
              <TouchableOpacity onPress={() => setShowAddTrip(false)}>
                <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView 
              contentContainerStyle={{ padding: 25, paddingBottom: 60 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              enableOnAndroid={true}
              extraScrollHeight={20}
            >
              <Text style={styles.modalSubtitle}>
                {isEditingTrip ? 'Update your trip details' : 'Share where you have been!'}
              </Text>

              <Text style={styles.inputLabel}>Where did you start? (Origin) *</Text>
              <View style={{ zIndex: 1000 }}>
                <TextInput 
                  style={styles.tripInput}
                  placeholder="e.g. New Delhi"
                  value={tripForm.origin}
                  onChangeText={(t) => fetchSuggestions(t, 'origin')}
                  onFocus={() => {
                    setActiveField('origin');
                    if (tripForm.origin.length >= 3) setShowSuggestions(true);
                  }}
                />
                {showSuggestions && activeField === 'origin' && suggestions.length > 0 && (
                  <View style={styles.modalSuggestionsContainer}>
                    <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                      {suggestions.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => selectSuggestion(item)}
                        >
                          <Text style={styles.suggestionText}>{item.description}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <Text style={styles.inputLabel}>Where did you go? (Destination) *</Text>
              <View style={{ zIndex: 900 }}>
                <TextInput 
                  style={styles.tripInput}
                  placeholder="e.g. Bali, Indonesia"
                  value={tripForm.destination}
                  onChangeText={(t) => fetchSuggestions(t, 'destination')}
                  onFocus={() => {
                    setActiveField('destination');
                    if (tripForm.destination.length >= 3) setShowSuggestions(true);
                  }}
                />
                {showSuggestions && activeField === 'destination' && suggestions.length > 0 && (
                  <View style={styles.modalSuggestionsContainer}>
                    <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                      {suggestions.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => selectSuggestion(item)}
                        >
                          <Text style={styles.suggestionText}>{item.description}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: '48%' }}>
                  <Text style={styles.inputLabel}>Start Date *</Text>
                  <TouchableOpacity 
                    style={styles.tripInput}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={{ color: tripForm.startDate ? theme.text : theme.textLight }}>
                      {tripForm.startDate || 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={tripForm.startDate ? new Date(tripForm.startDate) : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        setShowStartDatePicker(false);
                        if (date) {
                          setTripForm(f => ({ ...f, startDate: date.toISOString().split('T')[0] }));
                        }
                      }}
                    />
                  )}
                </View>
                <View style={{ width: '48%' }}>
                  <Text style={styles.inputLabel}>End Date *</Text>
                  <TouchableOpacity 
                    style={styles.tripInput}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={{ color: tripForm.endDate ? theme.text : theme.textLight }}>
                      {tripForm.endDate || 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={tripForm.endDate ? new Date(tripForm.endDate) : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        setShowEndDatePicker(false);
                        if (date) {
                          setTripForm(f => ({ ...f, endDate: date.toISOString().split('T')[0] }));
                        }
                      }}
                    />
                  )}
                </View>
              </View>

              <Text style={styles.inputLabel}>Highlights (Optional)</Text>
              <TextInput 
                style={[styles.tripInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Any highlights or memories?"
                multiline
                numberOfLines={3}
                value={tripForm.details}
                onChangeText={(t) => setTripForm(f => ({ ...f, details: t }))}
              />

              <TouchableOpacity 
                style={[styles.submitTripBtn, submittingTrip && { opacity: 0.7 }]}
                onPress={handleAddTrip}
                disabled={submittingTrip}
              >
                {submittingTrip ? <ActivityIndicator color={COLORS.white} /> : (
                  <Text style={styles.submitTripBtnText}>
                    {isEditingTrip ? 'Update Trip' : 'Document Trip'}
                  </Text>
                )}
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* Profile Sections */}
      <View style={styles.historySection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.historyTitle}>My Trip History</Text>
          <TouchableOpacity 
            style={styles.addTripMiniBtn}
            onPress={() => {
              resetTripForm();
              setShowAddTrip(true);
            }}
          >
            <Ionicons name="add" size={20} color={theme.textWhite} />
            <Text style={styles.addTripMiniBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {user?.completedTrips && user.completedTrips.length > 0 ? (
          user.completedTrips.map((trip: any, index: number) => (
            <View key={trip._id || index} style={styles.tripItem}>
              <View style={styles.tripItemContent}>
                <View style={styles.tripIconContainer}>
                  <Ionicons name="airplane" size={24} color={theme.teal} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.tripCities}>{trip.origin.city} → {trip.destination.city}</Text>
                  <Text style={styles.tripDates}>
                    {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : ''} - 
                    {trip.endDate ? new Date(trip.endDate).toLocaleDateString() : ''}
                    ({trip.duration} days)
                  </Text>
                  {trip.details && (
                    <Text style={styles.tripDetailsText} numberOfLines={1}>{trip.details}</Text>
                  )}
                </View>
                <View style={styles.tripActions}>
                  <TouchableOpacity onPress={() => openEditTrip(trip)} style={styles.tripActionBtn}>
                    <Ionicons name="create-outline" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTrip(trip._id)} style={styles.tripActionBtn}>
                    <Ionicons name="trash-outline" size={22} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyTripsContainer}>
            <Ionicons name="trail-sign-outline" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyTripsText}>No trips documented yet</Text>
          </View>
        )}
      </View>


      {/* Action buttons */}
      <View style={styles.actionBtns}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Ionicons name="pencil-outline" size={20} color={theme.teal} />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={theme.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </KeyboardAwareScrollView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  heroContainer: { height: 380, position: 'relative' },
  heroPhoto: { width: '100%', height: '100%', resizeMode: 'cover', alignItems: 'center', justifyContent: 'center' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  prevPhotoZone: { position: 'absolute', left: 0, top: 0, width: '33%', height: '80%' },
  nextPhotoZone: { position: 'absolute', right: 0, top: 0, width: '67%', height: '80%' },
  photoDots: {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  photoDotActive: { backgroundColor: theme.textWhite, width: 18 },
  editPhotoBtn: {
    position: 'absolute', top: 52, right: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  heroInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { fontSize: FONTS.xxl, fontWeight: '800', color: theme.textWhite },
  heroAge: { fontSize: FONTS.base, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heroLocationText: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)' },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row', backgroundColor: theme.card,
    marginHorizontal: 20, marginTop: -24,
    borderRadius: 20, padding: 16, ...SHADOW.md, zIndex: 10,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: FONTS.xl, fontWeight: '800', color: theme.teal },
  statLabel: { fontSize: FONTS.xs, color: theme.textSecondary, marginTop: 2 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 2 },
  statLabelTeal: { color: theme.teal, fontWeight: '700' },
  statDivider: { width: 1, backgroundColor: theme.border },

  verifyBanner: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.teal + '30',
  },
  verifyBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  verifyIconBG: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  verifyTitle: {
    fontSize: FONTS.base,
    fontWeight: '700',
    color: theme.teal,
  },
  verifySubtitle: {
    fontSize: FONTS.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },

  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '800', color: theme.text, marginBottom: 12 },
  bioText: { fontSize: FONTS.base, color: theme.textSecondary, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: theme.tealLight, borderWidth: 1, borderColor: theme.teal + '40',
  },
  interestEmoji: { fontSize: 15 },
  interestLabel: { fontSize: FONTS.sm, color: theme.teal, fontWeight: '600' },
  langChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: theme.goldLight,
  },
  langLabel: { fontSize: FONTS.sm, color: theme.text, fontWeight: '500' },
  lookingChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: theme.orangeLight,
  },
  lookingLabel: { fontSize: FONTS.sm, color: theme.orange, fontWeight: '600' },
  travelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  travelText: { flex: 1, fontSize: FONTS.base, color: theme.textSecondary },
  travelValue: { color: theme.text, fontWeight: '600' },
  actionBtns: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 20, marginTop: 28,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderColor: theme.teal, borderRadius: RADIUS.full, paddingVertical: 14,
  },
  editBtnText: { color: theme.teal, fontWeight: '700', fontSize: FONTS.base },
  settingsBtn: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16,
    paddingVertical: 14, borderRadius: RADIUS.full,
    backgroundColor: theme.error + '10',
  },
  logoutText: { color: theme.error, fontWeight: '700', fontSize: FONTS.base },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  emptyTravelText: { fontSize: 13, color: theme.textSecondary, fontStyle: 'italic' },

  historySection: { backgroundColor: theme.background, marginTop: 15, padding: 25 },
  historyTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
  addTripMiniBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.teal, 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: RADIUS.full,
    gap: 4
  },
  addTripMiniBtnText: { fontSize: 14, fontWeight: '800', color: theme.textWhite },
  tripItem: { marginBottom: 15, borderRadius: 20, backgroundColor: theme.card, ...SHADOW.sm, overflow: 'hidden' },
  tripItemContent: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  tripIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.tealLight, alignItems: 'center', justifyContent: 'center' },
  tripCities: { fontSize: 16, fontWeight: '700', color: theme.text },
  tripDates: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  tripDetailsText: { fontSize: 13, color: theme.textSecondary, marginTop: 4, fontStyle: 'italic' },
  tripActions: { flexDirection: 'row', gap: 10 },
  tripActionBtn: { padding: 8 },
  emptyTripsContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTripsText: { fontSize: 14, color: theme.textSecondary, marginTop: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.text },
  modalSubtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8, marginTop: 12 },
  tripInput: { backgroundColor: theme.background, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: theme.border, padding: 14, fontSize: 16, color: theme.text },
  modalSuggestionsContainer: { backgroundColor: theme.card, borderRadius: RADIUS.md, ...SHADOW.md, marginTop: 4, borderWidth: 1, borderColor: theme.border },
  suggestionItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  suggestionText: { color: theme.text, fontSize: 14 },
  submitTripBtn: { backgroundColor: theme.teal, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginTop: 24, ...SHADOW.md },
  submitTripBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
