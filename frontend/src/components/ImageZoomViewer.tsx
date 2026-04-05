import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { LinearGradient } from 'expo-linear-gradient';

interface ImageZoomViewerProps {
  images: string[];
  title?: string;
  caption?: string;
  vibe?: string;
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
}

const ImageZoomViewer: React.FC<ImageZoomViewerProps> = ({
  images,
  title,
  caption,
  vibe,
  visible,
  initialIndex = 0,
  onClose,
}) => {
  const formattedImages = images
    .filter(Boolean)
    .map((uri) => ({ uri }));

  if (formattedImages.length === 0) return null;

  return (
    <ImageViewing
      images={formattedImages}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
      FooterComponent={({ imageIndex }) => (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.footer}
        >
          {vibe && (
            <View style={styles.vibeBadge}>
              <Text style={styles.vibeText}>{vibe}</Text>
            </View>
          )}
          {title && <Text style={styles.title}>{title}</Text>}
          {caption && <Text style={styles.caption}>{caption}</Text>}
          <Text style={styles.counter}>
            {(imageIndex ?? 0) + 1} / {formattedImages.length}
          </Text>
        </LinearGradient>
      )}
    />
  );
};

export default ImageZoomViewer;

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 60,
  },
  vibeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 8,
  },
  vibeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  caption: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 8,
  },
  counter: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
