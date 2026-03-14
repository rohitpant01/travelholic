import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RegisterHeader from '../../components/RegisterHeader';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { API_BASE_URL } from '../../api/client';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../../utils/theme';

export default function Step5PhotosScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const [photos, setPhotos] = useState<{ uri: string; isProfile: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    if (photos.length >= 6) return Alert.alert('Limit Reached', 'Maximum 6 photos allowed');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Allow photo access to upload photos');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [
        ...prev,
        { uri: result.assets[0].uri, isProfile: prev.length === 0 },
      ]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some(p => p.isProfile)) {
        updated[0].isProfile = true;
      }
      return updated;
    });
  };

  const setAsProfile = (index: number) => {
    setPhotos(prev => prev.map((p, i) => ({ ...p, isProfile: i === index })));
  };

  const handleUpload = async () => {
    if (photos.length < 3) return Alert.alert('More Photos Needed', 'Please upload at least 3 photos');

    setUploading(true);
    console.log('[UPLOAD] Starting upload for photos:', photos.map(p => p.uri));
    try {
      const formData = new FormData();
      photos.forEach((photo, index) => {
        const uri = Platform.OS === 'ios' ? photo.uri.replace('file://', '') : photo.uri;
        const photoFile = {
          uri: uri,
          name: `photo_${index}.jpg`,
          type: 'image/jpeg',
        };
        console.log(`[UPLOAD] Appending photo ${index}:`, photoFile);
        formData.append('photos', photoFile as any);
      });

      console.log('[UPLOAD] FormData contents appended. Calling API via native fetch...');

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/user/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Note: browser/system handles Content-Type + boundary automatically
        },
        body: formData,
      });

      const resData = await response.json();

      if (!response.ok) {
        throw { 
          response: { 
            data: resData,
            status: response.status 
          }
        };
      }

      dispatch(updateUser({ photos: resData.photos, registrationStep: 6 }));

      // Update profile step
      await userAPI.updateProfile({ registrationStep: 6 });
      navigation.navigate('Register_Step6');
    } catch (error: any) {
      console.error('[UPLOAD ERROR]', error);
      if (error.response) {
        console.error('[UPLOAD ERROR DATA]', error.response.data);
      }
      const errorMsg = error.response?.data?.debug 
        ? `Error: ${error.response.data.error}\nDebug: ${JSON.stringify(error.response.data.debug)}`
        : error.response?.data?.error || error.message || 'Photo upload failed';
      Alert.alert('Upload Failed', errorMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <RegisterHeader step={5} totalSteps={7} title="Add Your Photos"
        subtitle="Min. 3 photos · Max. 6 photos" onBack={() => {
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
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={COLORS.teal} />
          <Text style={styles.infoText}>
            First photo will be your profile picture. Tap a photo to set it as profile.
          </Text>
        </View>

        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => {
            const photo = photos[index];
            return (
              <TouchableOpacity
                key={index}
                style={[styles.photoSlot, photo?.isProfile && styles.photoSlotProfile]}
                onPress={photo ? () => setAsProfile(index) : pickImage}
              >
                {photo ? (
                  <>
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    {photo.isProfile && (
                      <View style={styles.profileBadge}>
                        <Text style={styles.profileBadgeText}>✦ Profile</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.error} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.addPhotoContent}>
                    <Ionicons name="add" size={32} color={index < 3 ? COLORS.teal : COLORS.textLight} />
                    <Text style={[styles.addPhotoLabel, index < 3 && styles.addPhotoRequired]}>
                      {index < 3 ? 'Required' : 'Optional'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.countText}>
          {photos.length}/6 photos added
          {photos.length < 3 && ` · Need ${3 - photos.length} more`}
        </Text>

        <TouchableOpacity
          style={[styles.addMoreBtn]}
          onPress={pickImage}
          disabled={photos.length >= 6}
        >
          <Ionicons name="images-outline" size={20} color={COLORS.teal} />
          <Text style={styles.addMoreText}>Add from Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextBtn, (uploading || photos.length < 3) && { opacity: 0.5 }]}
          onPress={handleUpload}
          disabled={uploading || photos.length < 3}
        >
          <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.nextBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {uploading ? <ActivityIndicator color={COLORS.white} /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cloud-upload-outline" size={20} color={COLORS.white} />
                <Text style={styles.nextBtnText}>Upload & Continue</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 40 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.tealLight, borderRadius: RADIUS.md,
    padding: 12, marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: FONTS.sm, color: COLORS.teal, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 },
  photoSlot: {
    width: '30%', aspectRatio: 3 / 4, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderStyle: 'dashed',
  },
  photoSlotProfile: { borderColor: COLORS.teal, borderStyle: 'solid', borderWidth: 3 },
  photo: { width: '100%', height: '100%' },
  profileBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.teal, paddingVertical: 4, alignItems: 'center',
  },
  profileBadgeText: { color: COLORS.white, fontSize: FONTS.xs, fontWeight: '700' },
  removeBtn: { position: 'absolute', top: 4, right: 4 },
  addPhotoContent: { alignItems: 'center', gap: 4 },
  addPhotoLabel: { fontSize: FONTS.xs, color: COLORS.textLight },
  addPhotoRequired: { color: COLORS.teal, fontWeight: '600' },
  countText: {
    textAlign: 'center', fontSize: FONTS.sm, color: COLORS.textSecondary, marginBottom: 12,
  },
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.teal, borderRadius: RADIUS.md,
    paddingVertical: 12, gap: 8, marginBottom: 20, borderStyle: 'dashed',
  },
  addMoreText: { color: COLORS.teal, fontSize: FONTS.base, fontWeight: '600' },
  nextBtn: { borderRadius: RADIUS.full, overflow: 'hidden' },
  nextBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700' },
});
