import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal,
  TouchableOpacity, Image, ActivityIndicator,
  Alert, Platform, PanResponder, GestureResponderEvent,
  PanResponderGestureState, Dimensions, ScrollView,
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

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageSize {
  width: number;
  height: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MIN_CROP_SIZE = 60;
const HANDLE_SIZE = 22;

// Which corner/edge is being dragged
type DragHandle =
  | 'tl' | 'tr' | 'bl' | 'br'   // corners
  | 'move';                         // entire box

export default function AddStoryModal({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const styles = getStyles(theme);

  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Crop mode state
  const [cropMode, setCropMode] = useState(false);
  const [cropBox, setCropBox] = useState<CropBox>({ x: 30, y: 30, width: 200, height: 200 });
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const [imageDisplaySize, setImageDisplaySize] = useState<ImageSize>({ width: 1, height: 1 });
  const [naturalImageSize, setNaturalImageSize] = useState<ImageSize>({ width: 1, height: 1 });

  const dragHandle = useRef<DragHandle | null>(null);
  const dragStart = useRef<{ x: number; y: number; box: CropBox } | null>(null);

  // ─── Image Pick ─────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setNaturalImageSize({ width: asset.width, height: asset.height });
      setFlipped(false);
      setRotation(0);
      setCropMode(false);
    }
  };

  // ─── Edit Actions ────────────────────────────────────────────────────────────

  const handleFlip = async () => {
    if (!image) return;
    try {
      const result = await ImageManipulator.manipulateAsync(
        image,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(result.uri);
      setFlipped(f => !f);
    } catch {
      Alert.alert('Error', 'Could not flip the image.');
    }
  };

  const handleRotate = async () => {
    if (!image) return;
    try {
      const newRotation = (rotation + 90) % 360;
      const result = await ImageManipulator.manipulateAsync(
        image,
        [{ rotate: 90 }],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(result.uri);
      setRotation(newRotation);
      // After rotating, reload natural size
      Image.getSize(result.uri, (w, h) => setNaturalImageSize({ width: w, height: h }));
    } catch {
      Alert.alert('Error', 'Could not rotate the image.');
    }
  };

  // ─── Crop Mode ───────────────────────────────────────────────────────────────

  const enterCropMode = () => {
    // Initialize crop box to cover 80% of the displayed image, centred
    const pad = 0.1;
    const w = imageDisplaySize.width * 0.8;
    const h = imageDisplaySize.height * 0.8;
    const x = (containerSize.width - w) / 2;
    const y = (containerSize.height - h) / 2;
    setCropBox({ x, y, width: w, height: h });
    setCropMode(true);
  };

  const cancelCrop = () => setCropMode(false);

  /**
   * Convert the screen-space cropBox into image-space coordinates and apply.
   */
  const applyCrop = async () => {
    if (!image) return;

    // The image is rendered as cover inside the container.
    // We need to figure out how the image is actually displayed (letterbox/pillarbox).
    const containerW = containerSize.width;
    const containerH = containerSize.height;
    const natW = naturalImageSize.width;
    const natH = naturalImageSize.height;

    // Scale factors for cover mode
    const scaleX = containerW / natW;
    const scaleY = containerH / natH;
    const scale = Math.min(scaleX, scaleY); // contain = min

    // Displayed image dimensions
    const dispW = natW * scale;
    const dispH = natH * scale;

    // Offset of displayed image within container (centred)
    const offsetX = (containerW - dispW) / 2;
    const offsetY = (containerH - dispH) / 2;

    // Convert cropBox from container space → displayed image space → natural image space
    const cropXInDisp = cropBox.x - offsetX;
    const cropYInDisp = cropBox.y - offsetY;

    const originX = Math.max(0, Math.round(cropXInDisp / scale));
    const originY = Math.max(0, Math.round(cropYInDisp / scale));
    const cropW = Math.min(natW - originX, Math.round(cropBox.width / scale));
    const cropH = Math.min(natH - originY, Math.round(cropBox.height / scale));

    if (cropW <= 0 || cropH <= 0) {
      Alert.alert('Invalid crop', 'Please select a larger area.');
      return;
    }

    try {
      setLoading(true);
      const result = await ImageManipulator.manipulateAsync(
        image,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.92 }
      );
      setImage(result.uri);
      setNaturalImageSize({ width: cropW, height: cropH });
      setCropMode(false);
    } catch {
      Alert.alert('Error', 'Could not crop the image.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Pan Responder for Crop Handles ─────────────────────────────────────────

  const clampBox = (box: CropBox, cW: number, cH: number): CropBox => {
    let { x, y, width, height } = box;
    width = Math.max(MIN_CROP_SIZE, width);
    height = Math.max(MIN_CROP_SIZE, height);
    x = Math.max(0, Math.min(x, cW - width));
    y = Math.max(0, Math.min(y, cH - height));
    width = Math.min(width, cW - x);
    height = Math.min(height, cH - y);
    return { x, y, width, height };
  };

  const makePanResponder = useCallback((handle: DragHandle) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        dragHandle.current = handle;
        dragStart.current = { x: gs.x0, y: gs.y0, box: { ...cropBox } };
      },
      onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        if (!dragStart.current) return;
        const dx = gs.moveX - dragStart.current.x;
        const dy = gs.moveY - dragStart.current.y;
        const start = dragStart.current.box;
        const cW = containerSize.width;
        const cH = containerSize.height;

        let next: CropBox = { ...start };

        switch (handle) {
          case 'move':
            next.x = start.x + dx;
            next.y = start.y + dy;
            break;
          case 'tl':
            next.x = start.x + dx;
            next.y = start.y + dy;
            next.width = start.width - dx;
            next.height = start.height - dy;
            break;
          case 'tr':
            next.y = start.y + dy;
            next.width = start.width + dx;
            next.height = start.height - dy;
            break;
          case 'bl':
            next.x = start.x + dx;
            next.width = start.width - dx;
            next.height = start.height + dy;
            break;
          case 'br':
            next.width = start.width + dx;
            next.height = start.height + dy;
            break;
        }

        setCropBox(clampBox(next, cW, cH));
      },
      onPanResponderRelease: () => {
        dragHandle.current = null;
        dragStart.current = null;
      },
    }), [cropBox, containerSize]);

  // Build pan responders (memo'd per cropBox change)
  const panMove = makePanResponder('move');
  const panTL = makePanResponder('tl');
  const panTR = makePanResponder('tr');
  const panBL = makePanResponder('bl');
  const panBR = makePanResponder('br');

  // ─── Compress & Upload ───────────────────────────────────────────────────────

  const compressImage = async (uri: string) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const sizeInMB = (fileInfo as any).size / (1024 * 1024);
      const quality = sizeInMB > 3 ? 0.6 : sizeInMB > 1 ? 0.7 : 0.8;
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch {
      return uri;
    }
  };

  const handleUpload = async () => {
    if (!image) return;
    try {
      const compressedUri = await compressImage(image);
      const formData = new FormData();
      const filename = compressedUri.split('/').pop() || `story_${Date.now()}.jpg`;
      formData.append('media', {
        uri: Platform.OS === 'ios' ? compressedUri.replace('file://', '') : compressedUri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      dispatch(createStoryAction(formData)).unwrap()
        .then(() => dispatch(fetchStories()))
        .catch(() => Alert.alert('Upload Failed', 'Could not share your story. Please try again.'));

      setImage(null);
      setFlipped(false);
      setRotation(0);
      setCropMode(false);
      onClose();
    } catch {
      Alert.alert('Upload Failed', 'Something went wrong while preparing your story.');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={cropMode ? cancelCrop : onClose}
            disabled={loading}
            style={styles.headerBtn}
          >
            <Ionicons name={cropMode ? 'arrow-back' : 'close'} size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {cropMode ? 'Crop Photo' : 'Add Travel Story'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {image ? (
            <View
              style={styles.previewContainer}
              onLayout={e => {
                const { width, height } = e.nativeEvent.layout;
                setContainerSize({ width, height });
                // Compute how the image is displayed (cover mode) for accurate coordinate math
                const natW = naturalImageSize.width || 1;
                const natH = naturalImageSize.height || 1;
                const scale = Math.max(width / natW, height / natH);
                setImageDisplaySize({ width: natW * scale, height: natH * scale });
              }}
            >
              <Image source={{ uri: image }} style={styles.previewImage} />

              {/* ── Crop Overlay ────────────────────────────────────────────── */}
              {cropMode && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {/* Dark masks around the crop box */}
                  {/* Top */}
                  <View style={[styles.cropMask, {
                    top: 0, left: 0, right: 0,
                    height: cropBox.y,
                  }]} />
                  {/* Bottom */}
                  <View style={[styles.cropMask, {
                    left: 0, right: 0, bottom: 0,
                    top: cropBox.y + cropBox.height,
                  }]} />
                  {/* Left */}
                  <View style={[styles.cropMask, {
                    left: 0, top: cropBox.y,
                    width: cropBox.x,
                    height: cropBox.height,
                  }]} />
                  {/* Right */}
                  <View style={[styles.cropMask, {
                    right: 0, top: cropBox.y,
                    left: cropBox.x + cropBox.width,
                    height: cropBox.height,
                  }]} />

                  {/* Crop box (draggable to move) */}
                  <View
                    {...panMove.panHandlers}
                    style={[styles.cropBox, {
                      left: cropBox.x,
                      top: cropBox.y,
                      width: cropBox.width,
                      height: cropBox.height,
                    }]}
                  >
                    {/* Rule-of-thirds grid lines */}
                    <View style={[styles.gridLine, styles.gridV1]} />
                    <View style={[styles.gridLine, styles.gridV2]} />
                    <View style={[styles.gridLine, styles.gridH1]} />
                    <View style={[styles.gridLine, styles.gridH2]} />

                    {/* Corner handles — each has its own pan responder */}
                    <View {...panTL.panHandlers} style={[styles.handle, styles.handleTL]} />
                    <View {...panTR.panHandlers} style={[styles.handle, styles.handleTR]} />
                    <View {...panBL.panHandlers} style={[styles.handle, styles.handleBL]} />
                    <View {...panBR.panHandlers} style={[styles.handle, styles.handleBR]} />
                  </View>
                </View>
              )}

              {/* ── Edit Toolbar (non-crop mode) ────────────────────────────── */}
              {!cropMode && (
                <View style={styles.editToolbarWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.editToolbarScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    <TouchableOpacity style={styles.editBtn} onPress={handleFlip} disabled={loading}>
                      <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                      <Text style={styles.editBtnText}>Flip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.editBtn} onPress={handleRotate} disabled={loading}>
                      <Ionicons name="refresh" size={16} color="#FFFFFF" />
                      <Text style={styles.editBtnText}>Rotate</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.editBtn} onPress={enterCropMode} disabled={loading}>
                      <Ionicons name="crop" size={16} color="#FFFFFF" />
                      <Text style={styles.editBtnText}>Crop</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => { setImage(null); setFlipped(false); setRotation(0); setCropMode(false); }}
                      disabled={loading}
                    >
                      <Ionicons name="images-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.editBtnText}>Change</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
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

        {/* Footer */}
        <View style={styles.footer}>
          {cropMode ? (
            <View style={styles.cropFooter}>
              <TouchableOpacity style={styles.cropCancelBtn} onPress={cancelCrop} disabled={loading}>
                <Text style={styles.cropCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cropApplyBtn} onPress={applyCrop} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.cropApplyText}>Apply Crop</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.shareBtn, (!image || loading) && styles.disabledBtn]}
              onPress={handleUpload}
              disabled={!image || loading}
            >
              {loading
                ? <ActivityIndicator color={theme.textWhite} />
                : <Text style={styles.shareBtnText}>Share Story</Text>
              }
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: theme.mode === 'dark' ? '#2C2C2E' : '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },

  content: { flex: 1, paddingHorizontal: 16 },

  // ── Empty state ─────────────────────────────────────────────────────────────
  uploadBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.mode === 'dark' ? '#1C1C1E' : '#F2F2F7',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.teal + '20',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  uploadTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 8 },
  uploadSubtitle: { fontSize: 14, color: theme.textLight, textAlign: 'center' },

  // ── Preview ─────────────────────────────────────────────────────────────────
  previewContainer: {
    flex: 1, borderRadius: 20, overflow: 'hidden', position: 'relative',
    backgroundColor: '#000000',
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'contain' },

  // ── Edit toolbar ────────────────────────────────────────────────────────────
  editToolbarWrapper: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  editToolbarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  editBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // ── Crop overlay ────────────────────────────────────────────────────────────
  cropMask: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  // Grid lines (rule of thirds)
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridV1: { left: '33.33%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridV2: { left: '66.66%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridH1: { top: '33.33%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  gridH2: { top: '66.66%', left: 0, right: 0, height: StyleSheet.hairlineWidth },

  // Corner handles
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE, height: HANDLE_SIZE,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  handleTL: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  handleTR: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  handleBL: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  handleBR: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: { padding: 24 },
  shareBtn: {
    backgroundColor: theme.teal,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.45 },
  shareBtnText: { color: theme.textWhite, fontWeight: '700', fontSize: 16 },

  cropFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  cropCancelBtn: {
    flex: 1,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.mode === 'dark' ? '#2C2C2E' : '#E5E5EA',
  },
  cropCancelText: { color: theme.text, fontWeight: '600', fontSize: 15 },
  cropApplyBtn: {
    flex: 2,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.teal,
  },
  cropApplyText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});