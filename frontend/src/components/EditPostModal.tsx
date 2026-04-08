import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { 
  View, Text, StyleSheet, 
  TouchableOpacity, ActivityIndicator, 
  Keyboard, Platform 
} from 'react-native';
import { 
  BottomSheetModal, 
  BottomSheetView, 
  BottomSheetBackdrop,
  BottomSheetTextInput
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { editPostAction } from '../store/slices/feedSlice';
import { useAppTheme, SHADOW, RADIUS, SPACING } from '../utils/theme';

interface Props {
  postId?: string;
  initialContent?: string;
  post?: any; // Added to handle ProfileScreen mismatch
  onSuccess?: () => void;
  onClose?: () => void; // Added for compatibility
}

const EditPostModal = forwardRef((props: Props, ref) => {
  const { postId: propPostId, initialContent: propContent, post, onSuccess, onClose } = props;
  
  const postId = post?._id || propPostId || '';
  const initialContent = post?.content || propContent || '';
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const styles = getStyles(theme);

  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);

  const bottomSheetRef = React.useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => {
      setContent(initialContent);
      bottomSheetRef.current?.present();
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  useEffect(() => {
    if (initialContent !== content) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const handleSave = async () => {
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) return;
    setLoading(true);
    try {
      await dispatch(editPostAction({ postId, data: { content: trimmedContent } })).unwrap();
      onSuccess?.();
      bottomSheetRef.current?.dismiss();
    } catch (error) {
      console.error('Edit post error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderBackdrop = React.useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} pressBehavior="none" />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      snapPoints={['50%', '85%']}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.card }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit Post</Text>
          <TouchableOpacity 
            style={[styles.saveBtn, (!(content || '').trim() || loading) && { opacity: 0.5 }]} 
            onPress={handleSave}
            disabled={!(content || '').trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.textWhite} />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <BottomSheetTextInput
          style={styles.input}
          multiline
          value={content}
          onChangeText={setContent}
          placeholder="Update your caption..."
          placeholderTextColor={theme.textLight}
          autoFocus
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const getStyles = (theme: any) => StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  saveBtn: {
    backgroundColor: theme.teal,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    ...SHADOW.sm,
  },
  saveBtnText: {
    color: theme.textWhite,
    fontWeight: '800',
    fontSize: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    textAlignVertical: 'top',
    lineHeight: 24,
    minHeight: 150,
    paddingBottom: 20,
  },
});

export default EditPostModal;
