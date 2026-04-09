import React, { useCallback, useMemo, useState, forwardRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Image, ActivityIndicator, Alert, Keyboard, Platform, Dimensions
} from 'react-native';
import { 
  BottomSheetModal, 
  BottomSheetFlatList, 
  BottomSheetTextInput, 
  BottomSheetBackdrop,
  BottomSheetFooter
} from '@gorhom/bottom-sheet';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../store';
import { 
  fetchComments, 
  addComment, 
  deleteComment, 
  editComment 
} from '../store/slices/commentSlice';
import { decrementCommentCount } from '../store/slices/feedSlice';
import OptionsMenu from './OptionsMenu';
import { useAppTheme } from '../utils/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🛡️ RE-RENDER STABILIZER: Move input logic to a separate memoized component
// This prevents the entire BottomSheetFooter from re-mounting on every keypress
const CommentInputArea = React.memo(({ postId }: { postId: string }) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddComment = async () => {
    if (!inputText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await dispatch(addComment({ postId, text: inputText.trim() })).unwrap();
      setInputText('');
      Keyboard.dismiss();
    } catch (e) {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[
      styles.inputWrapper, 
      { 
        borderTopColor: theme.border, 
        backgroundColor: theme.card,
        paddingBottom: Math.max(insets.bottom, 12)
      }
    ]}>
      <Image 
        source={{ uri: currentUser?.photos?.[0]?.url || 'https://via.placeholder.com/150' }} 
        style={styles.smallAvatar} 
      />
      <BottomSheetTextInput
        style={[
          styles.input, 
          { 
            color: theme.text, 
            backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            textAlignVertical: 'center'
          }
        ]}
        placeholder="Add a comment..."
        placeholderTextColor={theme.textLight}
        value={inputText}
        onChangeText={setInputText}
        multiline
      />
      <TouchableOpacity 
        onPress={handleAddComment}
        disabled={!inputText.trim() || isSubmitting}
      >
        <Text style={[styles.postBtn, { color: inputText.trim() ? theme.teal : theme.textLight }]}>
          Post
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export interface CommentItem {
  _id: string;
  userId: {
    _id: string;
    username: string;
    photos: { url: string }[];
  };
  text: string;
  createdAt: string;
}

interface Props {
  postId: string;
}

const PostCommentsModal = forwardRef<BottomSheetModal, Props>(({ postId }, ref) => {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const { comments, loading } = useSelector((state: RootState) => state.comments);

  const [selectedComment, setSelectedComment] = useState<CommentItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // 🔄 REACTIVE FETCHING: Load comments exactly when postId changes
  // This is more reliable than onAnimate for fast transitions
  React.useEffect(() => {
    if (postId) {
      dispatch(fetchComments(postId));
    }
  }, [postId, dispatch]);

  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  const handleEditComment = (comment: CommentItem) => {
    Alert.prompt('Edit Comment', 'Update your comment:', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Save', 
        onPress: (text) => {
          if (text && text.trim()) {
            dispatch(editComment({ commentId: comment._id, text: text.trim() }));
          }
        }
      }
    ], 'plain-text', (comment.text || ''));
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatch(deleteComment(commentId)).unwrap();
            dispatch(decrementCommentCount(postId));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete comment');
          }
        }
      }
    ]);
  };

  const handlePressProfile = (userId: string) => {
    (ref as any).current?.dismiss();
    setTimeout(() => {
      if (userId === currentUser?._id) {
        navigation.navigate('Profile');
      } else {
        navigation.navigate('UserDetail', { userId: String(userId) });
      }
    }, 100);
  };

  const renderComment = ({ item }: { item: CommentItem }) => {
    const isMyComment = item.userId?._id === currentUser?._id;

    return (
      <View style={styles.commentRow}>
        <TouchableOpacity onPress={() => handlePressProfile(item.userId?._id)}>
          <Image 
            source={{ uri: item.userId?.photos?.[0]?.url || 'https://via.placeholder.com/150' }} 
            style={styles.avatar} 
          />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <TouchableOpacity onPress={() => handlePressProfile(item.userId?._id)}>
              <Text style={[styles.username, { color: theme.text }]}>{(item.userId?.username || 'traveler').trim()}</Text>
            </TouchableOpacity>
            <Text style={[styles.timestamp, { color: theme.textLight }]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <Text style={[styles.commentText, { color: theme.text }]}>{(item.text || '').trim()}</Text>
        </View>
        {isMyComment && (
          <TouchableOpacity 
            onPress={() => {
              setSelectedComment(item);
              setMenuVisible(true);
            }}
            style={styles.moreBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={theme.textLight} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFooter = useCallback(
    (props: any) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <CommentInputArea postId={postId} />
      </BottomSheetFooter>
    ),
    [postId]
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={{ backgroundColor: theme.card }}
      handleIndicatorStyle={{ backgroundColor: theme.mode === 'dark' ? '#555' : '#ccc' }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
    >
      <View style={styles.sheetContainer}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Comments</Text>
          <TouchableOpacity onPress={() => (ref as any).current?.dismiss()}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {loading && comments.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.teal} />
            </View>
          ) : (
            <BottomSheetFlatList
              data={comments}
              keyExtractor={(item) => item._id}
              renderItem={renderComment}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={{ color: theme.textLight }}>No comments yet. Start the conversation!</Text>
                </View>
              }
            />
          )}
        </View>
      </View>

      {selectedComment && (
        <OptionsMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          options={[
            { label: 'Edit', iconName: 'pencil-outline', onPress: () => handleEditComment(selectedComment) },
            { label: 'Delete', iconName: 'trash-outline', color: theme.error, onPress: () => handleDeleteComment(selectedComment._id) }
          ]}
        />
      )}
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 80, // Space for footer
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    padding: 20,
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#333',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  moreBtn: {
    padding: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12, // Standard iOS safe area padding
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  smallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
  },
  postBtn: {
    fontWeight: '700',
    fontSize: 14,
  },
});

export default PostCommentsModal;