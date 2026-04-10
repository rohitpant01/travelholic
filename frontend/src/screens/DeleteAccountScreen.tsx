import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { logout } from '../store/slices/authSlice';
import { userAPI } from '../api/services';
import storage from '../utils/storage';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';

export default function DeleteAccountScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  
  const { user } = useSelector((s: RootState) => s.auth);
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirmText.toUpperCase() !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE exactly to confirm.');
      return;
    }

    setLoading(true);
    try {
      const res = await userAPI.deleteAccount(password);
      if (res.data.success) {
        Alert.alert(
          'Account Scheduled',
          res.data.message,
          [
            {
              text: 'OK',
              onPress: async () => {
                await storage.removeSecureItem('token');
                await storage.removeItem('user');
                dispatch(logout());
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Landing' }],
                });
              }
            }
          ]
        );
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || 'Failed to schedule deletion. Please check your password.';
      Alert.alert('Security Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.warningBox}>
        <MaterialCommunityIcons name="alert-decagram" size={48} color={theme.error} />
        <Text style={styles.warningTitle}>Before you delete...</Text>
        <Text style={styles.warningText}>
          Deleting your account is a serious action. Here is what will happen:
        </Text>
      </View>

      <View style={styles.lossList}>
        <View style={styles.lossItem}>
          <Ionicons name="chatbubbles-outline" size={20} color={theme.textSecondary} />
          <Text style={styles.lossText}>All your matches and chats will be permanently removed.</Text>
        </View>
        <View style={styles.lossItem}>
          <Ionicons name="images-outline" size={20} color={theme.textSecondary} />
          <Text style={styles.lossText}>All travel moments and photos will be deleted from our servers.</Text>
        </View>
        <View style={styles.lossItem}>
          <Ionicons name="map-outline" size={20} color={theme.textSecondary} />
          <Text style={styles.lossText}>Your itineraries and trip history will be gone forever.</Text>
        </View>
        <View style={styles.lossItem}>
          <Ionicons name="time-outline" size={20} color={theme.info} />
          <Text style={styles.lossText}>
            <Text style={{ fontWeight: '700' }}>7-Day Safety Window:</Text> You can restore your account within 7 days by simply logging back in.
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.primaryBtn} 
        onPress={() => setStep(2)}
      >
        <Text style={styles.primaryBtnText}>Continue to Verification</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Verify Identity</Text>
      <Text style={styles.stepSubtitle}>
        For your security, please enter your password to authorize this request.
      </Text>

      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Enter current password"
          placeholderTextColor={theme.textLight}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoFocus
        />
      </View>

      <TouchableOpacity 
        style={[styles.primaryBtn, !password && styles.btnDisabled]} 
        onPress={() => setStep(3)}
        disabled={!password}
      >
        <Text style={styles.primaryBtnText}>Verify Password</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Final Confirmation</Text>
      <Text style={[styles.stepSubtitle, { color: theme.error }]}>
        Type <Text style={{ fontWeight: '900' }}>DELETE</Text> in the box below to confirm permanent account removal.
      </Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, { textAlign: 'center', letterSpacing: 2, fontWeight: '800' }]}
          placeholder="Type DELETE here"
          placeholderTextColor={theme.textLight}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoFocus
        />
      </View>

      <TouchableOpacity 
        style={[styles.dangerBtn, (confirmText !== 'DELETE' || loading) && styles.btnDisabled]} 
        onPress={handleDelete}
        disabled={confirmText !== 'DELETE' || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Schedule Account Deletion</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.progressRow}>
            {[1, 2, 3].map(i => (
              <View 
                key={i} 
                style={[
                  styles.progressDot, 
                  step >= i && { backgroundColor: i === 3 ? theme.error : theme.teal }
                ]} 
              />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  progressRow: { flexDirection: 'row', gap: 8 },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.border },
  
  scrollContent: { paddingHorizontal: 25, paddingBottom: 50 },
  stepContainer: { paddingTop: 20 },
  
  warningBox: { alignItems: 'center', marginBottom: 30 },
  warningTitle: { fontSize: 24, fontWeight: '800', color: theme.text, marginTop: 15 },
  warningText: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  
  lossList: { gap: 20, marginBottom: 40 },
  lossItem: { flexDirection: 'row', gap: 15, alignItems: 'flex-start', paddingRight: 20 },
  lossText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, flex: 1 },
  
  stepTitle: { fontSize: 28, fontWeight: '900', color: theme.text, marginBottom: 12 },
  stepSubtitle: { fontSize: 15, color: theme.textSecondary, lineHeight: 22, marginBottom: 30 },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1.5,
    borderColor: theme.border,
    marginBottom: 30,
    ...SHADOW.sm,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: theme.text, fontWeight: '500' },
  
  primaryBtn: {
    backgroundColor: theme.teal,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  dangerBtn: {
    backgroundColor: theme.error,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.textLight,
    marginTop: 40,
  }
});
