import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, Modal, 
  TouchableOpacity, Image, ActivityIndicator, 
  Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { createStoryAction, fetchStories } from '../store/slices/storySlice';
import { useAppTheme } from '../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddStoryModal({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const styles = getStyles(theme);
  
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  const compressImage = async (uri: string) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const sizeInMB = (fileInfo as any).size / (1024 * 1024);
      let quality = sizeInMB > 3 ? 0.6 : sizeInMB > 1 ? 0.7 : 0.8;
      
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }], 
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
      return uri;
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16], // Story aspect ratio
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!image) return;

    try {
      // Background compression and upload
      const compressedUri = await compressImage(image);
      const formData = new FormData();
      const filename = compressedUri.split('/').pop() || `story_${Date.now()}.jpg`;
      
      formData.append('media', {
        uri: Platform.OS === 'ios' ? compressedUri.replace('file://', '') : compressedUri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      // Start the upload in the background
      dispatch(createStoryAction(formData)).unwrap()
        .then(() => {
          dispatch(fetchStories());
        })
        .catch(() => {
          Alert.alert('Upload Failed', 'Could not share your story. Please try again.');
        });
      
      // Close immediately for a "seamless" feel
      setImage(null);
      onClose();
    } catch (error: any) {
      Alert.alert('Upload Failed', 'Something went wrong while preparing your story.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Travel Story</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.content}>
          {image ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              <TouchableOpacity 
                style={styles.retakeBtn} 
                onPress={() => setImage(null)}
                disabled={loading}
              >
                <Text style={styles.retakeText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera" size={40} color={theme.teal} />
              </View>
              <Text style={styles.uploadTitle}>Capture your Journey</Text>
              <Text style={styles.uploadSubtitle}>Select a vertical photo for your story</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.shareBtn, (!image || loading) && styles.disabledBtn]} 
            onPress={handleUpload}
            disabled={!image || loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.textWhite} />
            ) : (
              <Text style={styles.shareBtnText}>Share Story</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 20 
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  
  uploadBtn: { 
    alignItems: 'center', 
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderRadius: 30,
    padding: 40,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed'
  },
  iconCircle: {
     width: 80, height: 80, borderRadius: 40, backgroundColor: theme.teal + '15',
     justifyContent: 'center', alignItems: 'center', marginBottom: 20
  },
  uploadTitle: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 8 },
  uploadSubtitle: { fontSize: 14, color: theme.textLight, textAlign: 'center' },

  previewContainer: { flex: 1, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  retakeBtn: { 
    position: 'absolute', bottom: 20, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20
  },
  retakeText: { color: 'white', fontWeight: '700' },

  footer: { padding: 30 },
  shareBtn: { 
    backgroundColor: theme.teal, paddingVertical: 18, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center'
  },
  disabledBtn: { opacity: 0.5 },
  shareBtnText: { color: theme.textWhite, fontWeight: '800', fontSize: 16 },
});
