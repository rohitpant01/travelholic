import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Image, Platform
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
  const [city, setCity] = useState(user?.location?.city || '');
  const [country, setCountry] = useState(user?.location?.country || '');
  const [photos, setPhotos] = useState<any[]>(user?.photos || []);

  const handleSave = async () => {
    if (!firstName || !lastName) return Alert.alert('Error', 'Name is required');
    
    setLoading(true);
    try {
      const res = await userAPI.updateProfile({
        firstName,
        lastName,
        bio,
        city,
        country
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
      formData.append('photos', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const res = await userAPI.uploadPhotos(formData);
      setPhotos(res.data.photos);
      dispatch(updateUser({ photos: res.data.photos }));
    } catch (error: any) {
      Alert.alert('Upload Failed', error.response?.data?.error || 'Could not upload photo');
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
    <View style={styles.container}>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo Management Section */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <View style={styles.photoGrid}>
          {Array.from({ length: 6 }).map((_, index) => {
            const photo = photos[index];
            return (
              <View key={index} style={[styles.photoSlot, photo?.isProfile && styles.photoSlotProfile]}>
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
                onChangeText={setCity}
                placeholder="City"
              />
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
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
  row: { flexDirection: 'row' },
});
