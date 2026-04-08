import React, { useCallback, useMemo, useState, forwardRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Image, ActivityIndicator, Alert
} from 'react-native';
import { 
  BottomSheetModal, 
  BottomSheetFlatList, 
  BottomSheetBackdrop 
} from '@gorhom/bottom-sheet';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppDispatch, RootState } from '../store';
import { fetchPostLikes } from '../store/slices/feedSlice';
import { useAppTheme } from '../utils/theme';

interface UserLiker {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  photos: { url: string }[];
}

interface Props {
  postId: string;
}

const PostLikesModal = forwardRef<BottomSheetModal, Props>(({ postId }, ref) => {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const [users, setUsers] = useState<UserLiker[]>([]);
  const [loading, setLoading] = useState(false);

  const snapPoints = useMemo(() => ['50%', '70%'], []);

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

  const loadLikes = async () => {
    setLoading(true);
    try {
      const resultAction = await dispatch(fetchPostLikes(postId));
      if (fetchPostLikes.fulfilled.match(resultAction)) {
        setUsers(resultAction.payload);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load likes');
    } finally {
      setLoading(false);
    }
  };

  const handlePressUser = (userId: string) => {
    (ref as any).current?.dismiss();
    setTimeout(() => {
      if (userId === currentUser?._id) {
        navigation.navigate('Profile');
      } else {
        navigation.navigate('UserDetail', { userId });
      }
    }, 200);
  };

  const renderUser = ({ item }: { item: UserLiker }) => (
    <TouchableOpacity 
      style={styles.userRow} 
      onPress={() => handlePressUser(item._id)}
    >
      <Image 
        source={{ uri: item.photos?.[0]?.url || 'https://via.placeholder.com/150' }} 
        style={styles.avatar} 
      />
      <View>
        <Text style={[styles.name, { color: theme.text }]}>{item.firstName} {item.lastName}</Text>
        <Text style={[styles.username, { color: theme.textLight }]}>@{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.card }}
      handleIndicatorStyle={{ backgroundColor: theme.mode === 'dark' ? '#555' : '#ccc' }}
      onAnimate={(from, to) => {
        if (from === -1 && to === 0) {
          loadLikes();
        }
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Liked by</Text>
          <TouchableOpacity onPress={() => (ref as any).current?.dismiss()}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.teal} />
          </View>
        ) : (
          <BottomSheetFlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={renderUser}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ color: theme.textLight }}>No likes yet.</Text>
              </View>
            }
          />
        )}
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  list: { padding: 20 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
  },
  name: { fontSize: 14, fontWeight: '700' },
  username: { fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 40 },
});

export default PostLikesModal;
