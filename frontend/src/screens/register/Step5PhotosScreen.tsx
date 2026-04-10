import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import KeyboardWrapper from '../../components/KeyboardWrapper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import storage from '../../utils/storage';
import RegisterHeader from '../../components/RegisterHeader';
import { userAPI } from '../../api/services';
import { updateUser, logout } from '../../store/slices/authSlice';
import { useAppTheme, FONTS, RADIUS, SHADOW, SPACING } from '../../utils/theme';

export default function Step5PhotosScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);

  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // 📷 Pick image
  const pickImage = async () => {
    if (photos.length >= 6) {
      return Alert.alert("Limit Reached", "Maximum 6 photos allowed");
    }
    }
    
    // Play Store Rationale
    await new Promise<void>(resolve => {
      Alert.alert(
        'Photo Selection',
        'EkalGo needs access to your photos so you can choose the best moments from your travels to show in your profile.',
        [{ text: 'Continue', onPress: () => resolve() }]
      );
    });

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert("Permission Denied", "Allow photo access in Settings to upload your travel profile.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.6
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPhotos(prev => [
        ...prev,
        { uri, isProfile: prev.length === 0 }
      ]);
    }
  };

  // ❌ Remove photo
  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some(p => p.isProfile)) {
        updated[0].isProfile = true;
      }
      return updated;
    });
  };

  // ⭐ Set profile photo
  const setAsProfile = (index: number) => {
    setPhotos(prev =>
      prev.map((p, i) => ({
        ...p,
        isProfile: i === index
      }))
    );
  };

  // 🚀 Upload photos
  const handleUpload = async (): Promise<void | any> => {
    if (photos.length < 3) {
      return Alert.alert('Upload Photos', 'Please upload at least 3 photos');
    }

    setUploading(true);
    try {
      const formData = new FormData();
      photos.forEach((photo: any, index: number) => {
        const uri = photo.uri;
        const cleanPath = uri.split('?')[0];
        const extension = cleanPath.split('.').pop()?.toLowerCase() || 'jpg';
        const type = extension === 'png' ? 'image/png' : 'image/jpeg';
        const name = `image_${index}_${Date.now()}.${extension}`;
        const finalUri = Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri;

        formData.append('photos', {
          uri: finalUri,
          name: name,
          type: type,
        } as any);
      });

      const res = await userAPI.uploadPhotos(formData);
      const data = res.data;

      dispatch(updateUser({
        photos: data.photos,
        registrationStep: 7,
      }));

      await userAPI.updateProfile({ registrationStep: 7 });
      navigation.navigate('Register_Step6');
    } catch (err: any) {
      console.log('UPLOAD ERROR:', err);
      let msg = 'Upload failed';
      if (err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err.message) {
        msg = `${err.message}${err.code ? ` (${err.code})` : ''}`;
      }
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <RegisterHeader
        step={6}
        totalSteps={8}
        title="Add Your Photos"
        subtitle="Min. 3 photos · Max. 6 photos"
        onBack={() => navigation.goBack()}
      />

      <KeyboardWrapper backgroundColor={theme.background} contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => {
            const photo = photos[index];
            return (
              <TouchableOpacity
                key={photo?.uri || index}
                style={[styles.photoSlot, photo?.isProfile && styles.photoSlotProfile]}
                onPress={photo ? () => setAsProfile(index) : pickImage}
              >
                {photo ? (
                  <>
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={22} color={theme.error} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Ionicons name="add" size={32} color={theme.textLight} />
                    <Text style={{ color: theme.textLight, marginTop: 4, fontSize: 12 }}>Add</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={theme.textWhite} />
          ) : (
            <Text style={styles.uploadBtnText}>Upload & Continue</Text>
          )}
        </TouchableOpacity>
      </KeyboardWrapper>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  content: { padding: 20 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20
  },
  photoSlot: {
    width: "31%",
    aspectRatio: 3 / 4,
    backgroundColor: theme.card,
    marginBottom: 12,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  photoSlotProfile: {
    borderColor: theme.teal,
    borderWidth: 2,
  },
  photo: {
    width: "100%",
    height: "100%"
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: theme.background,
    borderRadius: 12,
  },
  uploadBtn: {
    backgroundColor: theme.teal,
    padding: 16,
    borderRadius: RADIUS.full,
    alignItems: "center",
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
      android: { elevation: 2 },
    }),
  },
  uploadBtnText: {
    color: theme.textWhite,
    fontWeight: "bold",
    fontSize: FONTS.md,
  },
});