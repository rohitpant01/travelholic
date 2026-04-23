import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator,
  Platform, Keyboard, ScrollView, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { editPostAction } from '../store/slices/feedSlice';
import { useAppTheme, SHADOW } from '../utils/theme';

interface Props {
  postId?: string;
  initialContent?: string;
  post?: any;
  onSuccess?: () => void;
  onClose?: () => void;
}

const EditPostModal = forwardRef((props: Props, ref) => {
  const { postId: propPostId, initialContent: propContent, post, onSuccess, onClose } = props;

  const postId = post?._id || propPostId || '';
  const initialContent = post?.content || propContent || '';
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);

  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useImperativeHandle(ref, () => ({
    present: () => {
      setContent(initialContent);
      setVisible(true);
    },
    dismiss: () => {
      setVisible(false);
      onClose?.();
    },
  }));

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

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

  const handleSave = async () => {
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) return;
    setLoading(true);
    try {
      await dispatch(editPostAction({ postId, data: { content: trimmedContent } })).unwrap();
      onSuccess?.();
      setVisible(false);
      onClose?.();
    } catch (error) {
      console.error('Edit post error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={loading} style={styles.closeBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Post</Text>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!(content || '').trim() || loading) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!(content || '').trim() || loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={theme.textWhite} />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 250 : 100,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={true}
          >
            <TextInput
              style={styles.input}
              multiline
              value={content}
              onChangeText={setContent}
              placeholder="Update your caption..."
              placeholderTextColor={theme.textLight}
              autoFocus
              scrollEnabled={false}
              textAlignVertical="top"
              maxLength={2000}
            />
          </ScrollView>

          {/* Character Count */}
          <View style={styles.footer}>
            <Text style={styles.charCount}>{content.length}/2000</Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const getStyles = (theme: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: insets.top + (Platform.OS === 'ios' ? 10 : 15),
    paddingBottom: 12,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  closeBtn: {
    padding: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  saveBtn: {
    backgroundColor: theme.teal,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 72,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: theme.textWhite,
    fontWeight: '800',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  input: {
    fontSize: 16,
    color: theme.text,
    lineHeight: 26,
    textAlignVertical: 'top',
    minHeight: 300,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    backgroundColor: theme.background,
    paddingBottom: Math.max(insets.bottom, 10),
  },
  charCount: {
    fontSize: 12,
    color: theme.textLight,
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default EditPostModal;