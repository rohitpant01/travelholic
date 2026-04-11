import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, Pressable, StatusBar, Platform, KeyboardAvoidingView
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppDispatch, RootState } from '../store';
import { setUser } from '../store/slices/authSlice';
import { userAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { GOOGLE_MAPS_API_KEY } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TripHistoryScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s: RootState) => s.auth);

  const [showAddTrip, setShowAddTrip] = useState(false);
  const [submittingTrip, setSubmittingTrip] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<'origin' | 'destination'>('origin');

  const [tripForm, setTripForm] = useState({
    _id: '',
    origin: '',
    destination: '',
    startDate: '',
    endDate: '',
    details: ''
  });

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

  const resetTripForm = () => {
    setTripForm({ _id: '', origin: '', destination: '', startDate: '', endDate: '', details: '' });
    setIsEditingTrip(false);
  };

  const handleAddTrip = async () => {
    if (!tripForm.origin || !tripForm.destination || !tripForm.startDate || !tripForm.endDate) {
      Alert.alert('Error', 'Please fill in all mandatory fields');
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
        Alert.alert('Success', isEditingTrip ? 'Trip updated!' : 'Trip added!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save trip');
    } finally {
      setSubmittingTrip(false);
    }
  };

  const handleDeleteTrip = (tripId: string) => {
    Alert.alert('Delete Trip', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await userAPI.deleteCompletedTrip(tripId);
            dispatch(setUser({ ...user!, completedTrips: res.data.trips }));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete trip');
          }
        }
      }
    ]);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Trip History</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            resetTripForm();
            setShowAddTrip(true);
          }}
        >
          <Ionicons name="add-circle" size={28} color={theme.teal} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {user?.completedTrips && user.completedTrips.length > 0 ? (
          user.completedTrips.map((trip: any, index: number) => (
            <View key={trip._id || index} style={styles.tripItem}>
              <View style={styles.tripItemContent}>
                <View style={[styles.tripIconContainer, { backgroundColor: theme.tealLight }]}>
                  <Ionicons name="airplane" size={24} color={theme.teal} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.tripCities}>{trip.origin.city} → {trip.destination.city}</Text>
                  <Text style={styles.tripDates}>
                    {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : ''} - {trip.endDate ? new Date(trip.endDate).toLocaleDateString() : ''}
                  </Text>
                  {trip.details && (
                    <Text style={styles.tripDetailsText}>{trip.details}</Text>
                  )}
                </View>
                <View style={styles.tripActions}>
                  <TouchableOpacity onPress={() => openEditTrip(trip)} style={styles.tripActionBtn}>
                    <Ionicons name="create-outline" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTrip(trip._id)} style={styles.tripActionBtn}>
                    <Ionicons name="trash-outline" size={22} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="trail-sign-outline" size={64} color={theme.textSecondary + '40'} />
            <Text style={styles.emptyText}>No trips documented yet</Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => {
                resetTripForm();
                setShowAddTrip(true);
              }}
            >
              <Text style={styles.emptyAddBtnText}>Document Your First Trip</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal 
        visible={showAddTrip} 
        animationType="slide" 
        transparent
        onRequestClose={() => setShowAddTrip(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddTrip(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditingTrip ? 'Edit Trip' : 'Add Past Trip'}</Text>
                <TouchableOpacity onPress={() => setShowAddTrip(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <KeyboardAwareScrollView
                bounces={false}
                enableOnAndroid={true}
                extraHeight={120}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>Where did you start?</Text>
                <TextInput
                  style={styles.tripInput}
                  placeholder="Origin City"
                  placeholderTextColor={theme.textSecondary}
                  value={tripForm.origin}
                  onChangeText={(val) => fetchSuggestions(val, 'origin')}
                />
                {activeField === 'origin' && showSuggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {suggestions.map((item, idx) => (
                      <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                        <Text style={styles.suggestionText}>{item.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.inputLabel}>Where did you go?</Text>
                <TextInput
                  style={styles.tripInput}
                  placeholder="Destination City"
                  placeholderTextColor={theme.textSecondary}
                  value={tripForm.destination}
                  onChangeText={(val) => fetchSuggestions(val, 'destination')}
                />
                {activeField === 'destination' && showSuggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {suggestions.map((item, idx) => (
                      <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                        <Text style={styles.suggestionText}>{item.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Started On</Text>
                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowStartDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={18} color={theme.teal} />
                      <Text style={styles.datePickerText}>{tripForm.startDate || 'Select'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={styles.inputLabel}>Ended On</Text>
                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEndDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={18} color={theme.teal} />
                      <Text style={styles.datePickerText}>{tripForm.endDate || 'Select'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.inputLabel}>Any special memories? (Optional)</Text>
                <TextInput
                  style={[styles.tripInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Brief details..."
                  placeholderTextColor={theme.textSecondary}
                  value={tripForm.details}
                  onChangeText={(val) => setTripForm({ ...tripForm, details: val })}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.submitBtn, submittingTrip && { opacity: 0.7 }]}
                  onPress={handleAddTrip}
                  disabled={submittingTrip}
                >
                  {submittingTrip ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.submitBtnText}>{isEditingTrip ? 'Update History' : 'Add to History'}</Text>
                  )}
                </TouchableOpacity>
              </KeyboardAwareScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>

        {showStartDatePicker && (
          <DateTimePicker
            value={tripForm.startDate ? new Date(tripForm.startDate) : new Date()}
            mode="date" display="default"
            maximumDate={new Date()}
            onChange={(event, date) => {
              setShowStartDatePicker(false);
              if (date) setTripForm({ ...tripForm, startDate: date.toISOString().split('T')[0] });
            }}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            value={tripForm.endDate ? new Date(tripForm.endDate) : new Date()}
            mode="date" display="default"
            maximumDate={new Date()}
            onChange={(event, date) => {
              setShowEndDatePicker(false);
              if (date) setTripForm({ ...tripForm, endDate: date.toISOString().split('T')[0] });
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 15, backgroundColor: theme.card,
    borderBottomWidth: 1, borderBottomColor: theme.border
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.text },
  scrollContent: { padding: 20 },
  tripItem: { marginBottom: 15, borderRadius: 20, backgroundColor: theme.card, ...SHADOW.sm, overflow: 'hidden' },
  tripItemContent: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  tripIconContainer: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tripCities: { fontSize: 16, fontWeight: '700', color: theme.text },
  tripDates: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  tripDetailsText: { fontSize: 13, color: theme.textSecondary, marginTop: 8, fontStyle: 'italic', lineHeight: 18 },
  tripActions: { flexDirection: 'row', gap: 5 },
  tripActionBtn: { padding: 8 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, fontWeight: '600', color: theme.textSecondary, marginTop: 20 },
  emptyAddBtn: { marginTop: 20, backgroundColor: theme.teal, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 15 },
  emptyAddBtnText: { color: '#fff', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
  inputLabel: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8, marginTop: 15 },
  tripInput: { backgroundColor: theme.background, borderRadius: 12, borderWidth: 1.5, borderColor: theme.border, padding: 14, fontSize: 16, color: theme.text },
  suggestionsContainer: { backgroundColor: theme.background, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  suggestionItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  suggestionText: { color: theme.text, fontSize: 14 },
  dateRow: { flexDirection: 'row', gap: 15 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: theme.border, gap: 8 },
  datePickerText: { fontSize: 15, color: theme.text },
  submitBtn: { backgroundColor: theme.teal, borderRadius: 15, padding: 16, alignItems: 'center', marginTop: 30, ...SHADOW.md },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
