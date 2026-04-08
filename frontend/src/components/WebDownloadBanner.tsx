import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, SHADOW } from '../utils/theme';

interface Props {
  id?: string;
  type?: 'trip' | 'post' | 'user';
}

const WebDownloadBanner = ({ id, type = 'trip' }: Props) => {
  const theme = useAppTheme();
  const isWeb = Platform.OS === 'web';

  if (!isWeb) return null;

  const handleOpenApp = () => {
    let appUrl = 'ekalgo://';
    if (id) {
      if (type === 'trip') appUrl = `ekalgo://trip/${id}`;
      else if (type === 'post') appUrl = `ekalgo://post/${id}`;
      else if (type === 'user') appUrl = `ekalgo://user/${id}`;
    }

    Linking.openURL(appUrl).catch(() => {
      // Fallback to marketing site or store
      Linking.openURL('https://ekalgo.com/download');
    });
  };

  return (
    <LinearGradient 
      colors={[theme.teal, theme.tealDark]} 
      start={{ x: 0, y: 0 }} 
      end={{ x: 1, y: 0 }}
      style={{ padding: 15, marginHorizontal: 16, marginTop: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...SHADOW.md }}
    >
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Experience EkalGo in 3D ✨</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>Interactive maps & full social features in our app</Text>
      </View>
      <TouchableOpacity 
        style={{ backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 }}
        onPress={handleOpenApp}
      >
        <Text style={{ color: theme.teal, fontSize: 12, fontWeight: '800' }}>OPEN APP</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

export default WebDownloadBanner;
