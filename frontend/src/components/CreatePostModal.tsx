import React, { useState, useEffect } from 'react';
import { Pressable, 
  View, Text, StyleSheet, Modal,
  TouchableOpacity, TextInput, Image,
  ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Keyboard,
  Switch
 } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { createPostAction, addTempPost } from '../store/slices/feedSlice';
import { COLORS, SHADOW, useAppTheme } from '../utils/theme';
import { lyraAPI } from '../api/services';
import { requestLocationPermission } from '../utils/permissionUtils';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);

  const { user } = useSelector((state: RootState) => state.auth);
  const navigation = useNavigation<any>();

  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(null);

  // ✅ Track keyboard height for dynamic scroll padding
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const compressImage = async (uri: string) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
      console.warn('[COMPRESS ERROR]', e);
      return uri;
    }
  };

  const pickLocation = () => {
    navigation.navigate('LocationPicker', {
      onSelect: (loc: any) => setSelectedLocation(loc),
      initialLocation: selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : undefined
    });
  };

  const pickImages = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload up to 5 images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setImages([...images, ...uris]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const submitPostInBackground = async (contentStr: string, currentImages: string[], tempId: string, locationData: any, allowAI: boolean) => {
    try {
      // 1. Prioritize Selection -> then Current GPS -> then Profile
      let finalLocation: any = locationData ? {
        type: 'Point',
        coordinates: [locationData.lng, locationData.lat]
      } : null;

      if (!finalLocation) {
        const { status } = await requestLocationPermission(
          'Post Location',
          'Tag your travel moments with a location to help other travelers discover your journey.'
        );
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          finalLocation = { type: 'Point', coordinates: [loc.coords.longitude, loc.coords.latitude] };
        }
      }

      if (!finalLocation) {
        finalLocation = { type: 'Point', coordinates: [0, 0] };
      }

      // 2. Prepare FormData
      const formData = new FormData();
      formData.append('content', contentStr);
      formData.append('location', JSON.stringify(finalLocation));
      formData.append('placeName', locationData?.name || user?.city || 'India');
      formData.append('visibility', 'global');
      formData.append('allowAIItinerary', String(allowAI));

      // 3. Compress & Append Images
      if (currentImages.length > 0) {
        for (let i = 0; i < currentImages.length; i++) {
          const compressedUri = await compressImage(currentImages[i]);
          const filename = compressedUri.split('/').pop() || `post_${Date.now()}_${i}.jpg`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;

          formData.append('media', {
            uri: Platform.OS === 'ios' ? compressedUri.replace('file://', '') : compressedUri,
            name: filename,
            type,
          } as any);
        }
      }

      // 4. Dispatch Async Action
      const optimisticData = {
        content: contentStr,
        images: currentImages,
        user: {
          _id: user?._id,
          firstName: user?.firstName,
          lastName: user?.lastName,
          photos: user?.photos
        },
        allowAIItinerary: allowAI
      };

      await dispatch(createPostAction({ formData, optimisticData, tempId })).unwrap();
    } catch (error: any) {
      console.error('[POST ERROR]', error);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && images.length === 0) {
      Alert.alert('Empty Post', 'Please add some text or an image.');
      return;
    }

    // ✨ Enforce location for Lyra
    if (aiEnabled && !selectedLocation) {
      Alert.alert(
        'Location Required 📍',
        'Lyra needs to know exactly where you are to generate an accurate itinerary. Please tap the map icon to add a location.'
      );
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const placeName = selectedLocation?.name || user?.city;
    const optimisticPost = {
      _id: tempId,
      isTemporary: true,
      status: 'uploading',
      content,
      images,
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      placeName,
      userId: {
        _id: user?._id || 'me',
        firstName: user?.firstName || 'You',
        lastName: user?.lastName,
        photos: user?.photos
      },
      allowAIItinerary: aiEnabled
    };

    // 1. Add post to UI immediately
    dispatch(addTempPost(optimisticPost));

    // 2. Fire and forget background post upload
    submitPostInBackground(content, images, tempId, selectedLocation, aiEnabled);

    // 3. If AI toggle is ON → navigate to Lyra screen
    if (aiEnabled && content.trim()) {
      const captionForAI = content;
      const locationForAI = placeName || 'India';

      // Reset & close first
      setContent('');
      setImages([]);
      setSelectedLocation(null);
      setAiEnabled(false);
      onClose();

      // Navigate to Lyra with a small delay so modal fully closes
      setTimeout(() => {
        navigation.navigate('LyraItinerary', {
          caption: captionForAI,
          location: locationForAI,
          postId: tempId,
        });
      }, 300);
    } else {
      // Normal flow: just close
      setContent('');
      setImages([]);
      setSelectedLocation(null);
      setAiEnabled(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={loading} style={styles.closeBtn}>
              <Ionicons name="close" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Post</Text>
            <TouchableOpacity
              onPress={handlePost}
              disabled={loading || (!content.trim() && images.length === 0)}
              style={[
                styles.postBtn,
                (loading || (!content.trim() && images.length === 0)) && { opacity: 0.5 }
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.textWhite} />
              ) : (
                <Text style={styles.postBtnText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scroll} 
            contentContainerStyle={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 60 : 100 }} 
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {/* User Row */}
            <View style={styles.userRow}>
              <Image
                source={{ uri: user?.photos?.[0]?.url || 'https://via.placeholder.com/150' }}
                style={styles.avatar}
              />
              <View>
                <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location" size={12} color={theme.teal} />
                  <Text style={styles.locationText}>{selectedLocation?.name || user?.city || 'Nowhere'}</Text>
                </View>
              </View>
            </View>

            {/* Location Tag (if selected) */}
            {selectedLocation && (
              <View style={styles.selectedLocTag}>
                <Ionicons name="location" size={14} color={theme.teal} />
                <Text style={styles.selectedLocText} numberOfLines={1}>{selectedLocation.name}</Text>
                <TouchableOpacity onPress={() => setSelectedLocation(null)}>
                  <Ionicons name="close-circle" size={16} color={theme.textLight} />
                </TouchableOpacity>
              </View>
            )}

            {/* Content Input */}
            <TextInput
              style={styles.input}
              placeholder="What's happening on your journey?"
              placeholderTextColor={theme.textLight}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={2000}
              autoFocus={true}
              scrollEnabled={true}
              textAlignVertical="top"
            />

            {/* ✨ AI Travel Plan Toggle */}
            <TouchableOpacity
              style={[
                styles.aiToggleRow,
                aiEnabled && { backgroundColor: theme.teal + '08', borderColor: theme.teal }
              ]}
              onPress={() => setAiEnabled(!aiEnabled)}
              activeOpacity={0.7}
            >
              <View style={styles.aiToggleLeft}>
                <View style={[styles.aiIconWrap, aiEnabled && { backgroundColor: theme.teal }]}>
                  <Ionicons name="sparkles" size={14} color={aiEnabled ? '#fff' : theme.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiToggleTitle, { color: theme.text }]}>✨ AI Travel Plan</Text>
                  <Text style={[styles.aiToggleDesc, { color: theme.textSecondary }]}>
                    Lyra will generate an itinerary from your post
                  </Text>
                </View>
              </View>
              <Switch
                value={aiEnabled}
                onValueChange={setAiEnabled}
                trackColor={{ false: theme.border, true: theme.teal + '60' }}
                thumbColor={aiEnabled ? theme.teal : (theme.mode === 'dark' ? '#444' : '#f4f3f4')}
                style={{ transform: [{ scaleX: .8 }, { scaleY: .8 }] }}
              />
            </TouchableOpacity>

            {aiEnabled && (
              <View style={styles.aiHint}>
                <Ionicons name="information-circle-outline" size={14} color={theme.teal} />
                <Text style={[styles.aiHintText, { color: theme.teal }]}>
                  Write about your trip — Lyra will do the rest!
                </Text>
              </View>
            )}

            {/* Media Previews */}
            {images.length > 0 && (
              <ScrollView horizontal style={styles.imagePreviewList} showsHorizontalScrollIndicator={false}>
                {images.map((uri, i) => (
                  <View key={i} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeImage(i)}
                    >
                      <Ionicons name="close-circle" size={24} color="rgba(0,0,0,0.7)" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </ScrollView>

          {/* Bottom Toolbar */}
          <View style={styles.toolbar}>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <TouchableOpacity style={styles.toolBtn} onPress={pickImages} disabled={loading}>
                <Ionicons name="image-outline" size={28} color={theme.teal} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={pickLocation} disabled={loading}>
                <Ionicons name="map-outline" size={28} color={theme.teal} />
              </TouchableOpacity>
            </View>
            <Text style={styles.charCount}>{content.length}/2000</Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: insets.top + (Platform.OS === 'ios' ? 10 : 15),
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    backgroundColor: theme.background,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  postBtn: {
    backgroundColor: theme.teal,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 75,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  postBtnText: { color: theme.textWhite, fontWeight: '800', fontSize: 13 },

  scroll: { flex: 1, padding: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.border },
  userName: { fontSize: 16, fontWeight: '700', color: theme.text },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  input: {
    fontSize: 16,
    color: theme.text,
    minHeight: 120,
    maxHeight: 300,
    textAlignVertical: 'top',
    marginBottom: 16,
    lineHeight: 24,
  },
  selectedLocTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 16,
  },
  selectedLocText: {
    fontSize: 12,
    color: theme.teal,
    fontWeight: '600',
    maxWidth: 200,
  },

  // AI Toggle - Slimmed Down
  aiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    marginBottom: 8,
    backgroundColor: theme.card,
  },
  aiToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  aiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiToggleTitle: { fontSize: 13, fontWeight: '800' },
  aiToggleDesc: { fontSize: 10, fontWeight: '500', marginTop: 1 },

  aiHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    backgroundColor: theme.tealLight,
    borderRadius: 8,
  },
  aiHintText: { fontSize: 10, fontWeight: '600', flex: 1 },

  imagePreviewList: { flexDirection: 'row', marginBottom: 20 },
  imageWrapper: { position: 'relative', marginRight: 12 },
  previewImage: { width: 140, height: 180, borderRadius: 16 },
  removeBtn: { position: 'absolute', top: 6, right: 6 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    backgroundColor: theme.background,
    paddingBottom: Math.max(insets.bottom, 15) + (Platform.OS === 'ios' ? 10 : 5), 
  },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  charCount: { fontSize: 12, color: theme.textLight, fontWeight: '600' },
});
