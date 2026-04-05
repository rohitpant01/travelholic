import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  TextInput, ActivityIndicator, Image, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { COLORS, SHADOW, RADIUS, SPACING } from '../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const API_URL = 'http://localhost:5000/api'; // Update for production

export default function WaitlistModal({ visible, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState(1243);
  const [timeLeft, setTimeLeft] = useState({ days: 12, hours: 8, mins: 45, secs: 12 });

  useEffect(() => {
    // Basic countdown simulation
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.secs > 0) return { ...prev, secs: prev.secs - 1 };
        return { ...prev, secs: 59, mins: prev.mins - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleJoin = async () => {
    if (!email || !email.includes('@')) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/waitlist/join`, { 
        email, 
        source: 'web_teaser' 
      });
      setJoined(true);
      if (res.data.totalCount) setCount(res.data.totalCount);
    } catch (e) {
      console.warn("Waitlist joining failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onClose} />
        
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
             <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.inner}>
             {joined ? (
               <View style={styles.successView}>
                  <View style={styles.successIcon}>
                     <Ionicons name="checkmark-circle" size={80} color={COLORS.teal} />
                  </View>
                  <Text style={styles.successTitle}>You're on the list! 🎉</Text>
                  <Text style={styles.successDesc}>
                    We'll notify you as soon as EkalGo launches. Share with your friends to climb the leaderboard!
                  </Text>
                  <View style={styles.totalBadge}>
                     <Text style={styles.totalText}>Current Community: {count}+ Travelers</Text>
                  </View>
                  <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                     <Text style={styles.doneText}>Done</Text>
                  </TouchableOpacity>
               </View>
             ) : (
               <>
                 <View style={styles.logoBox}>
                    <Image source={require('../../assets/logo.png')} style={styles.logo} />
                 </View>
                 <Text style={styles.title}>🚀 EkalGo is Launching Soon!</Text>
                 <Text style={styles.subtitle}>
                    Don't miss the smartest travel revolution. Get early access to hidden gems, 
                    AI itineraries, and offline maps.
                 </Text>

                 {/* ⏳ COUNTDOWN */}
                 <View style={styles.countdownRow}>
                    <View style={styles.timeBox}>
                       <Text style={styles.timeVal}>{timeLeft.days}</Text>
                       <Text style={styles.timeLabel}>Days</Text>
                    </View>
                    <Text style={styles.timeDiv}>:</Text>
                    <View style={styles.timeBox}>
                       <Text style={styles.timeVal}>{timeLeft.hours}</Text>
                       <Text style={styles.timeLabel}>Hrs</Text>
                    </View>
                    <Text style={styles.timeDiv}>:</Text>
                    <View style={styles.timeBox}>
                       <Text style={styles.timeVal}>{timeLeft.mins}</Text>
                       <Text style={styles.timeLabel}>Mins</Text>
                    </View>
                 </View>

                 <View style={styles.form}>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Enter your email address" 
                      placeholderTextColor="#888"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <TouchableOpacity style={styles.submitBtn} onPress={handleJoin} disabled={loading}>
                       {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Get Early Access 🌍</Text>}
                    </TouchableOpacity>
                 </View>

                 <View style={styles.fomoBox}>
                    <View style={styles.avatarsRow}>
                       {/* Placeholder avatars for effect */}
                       <View style={[styles.avatar, {backgroundColor: '#ff9a9e'}]} />
                       <View style={[styles.avatar, {backgroundColor: '#fad0c4', marginLeft: -10}]} />
                       <View style={[styles.avatar, {backgroundColor: '#a1c4fd', marginLeft: -10}]} />
                    </View>
                    <Text style={styles.fomoText}>Join 1,243+ travelers already waiting.</Text>
                 </View>
               </>
             )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  dismiss: { ...StyleSheet.absoluteFillObject },
  modalContent: { 
    width: Platform.OS === 'web' ? 550 : '90%', 
    backgroundColor: '#fff', borderRadius: 30, overflow: 'hidden', padding: 40, ...SHADOW.lg 
  },
  closeBtn: { position: 'absolute', top: 20, right: 20, zIndex: 10 },
  inner: { alignItems: 'center' },
  logoBox: { 
    width: 80, height: 80, borderRadius: 20, backgroundColor: '#f8f9fa', 
    alignItems: 'center', justifyContent: 'center', marginBottom: 25 
  },
  logo: { width: 50, height: 50, borderRadius: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#1a1a1a', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 24, marginTop: 15, marginBottom: 30 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 35, gap: 10 },
  timeBox: { alignItems: 'center', minWidth: 60 },
  timeVal: { fontSize: 32, fontWeight: '900', color: COLORS.teal },
  timeLabel: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', marginTop: 2 },
  timeDiv: { fontSize: 24, fontWeight: '800', color: '#eee', marginTop: -15 },
  form: { width: '100%' },
  input: { 
    width: '100%', height: 60, backgroundColor: '#f5f7f9', borderRadius: 15, 
    paddingHorizontal: 20, fontSize: 16, color: '#333', marginBottom: 15,
    borderWidth: 1, borderColor: '#eee' 
  },
  submitBtn: { 
    width: '100%', height: 60, backgroundColor: COLORS.teal, borderRadius: 15, 
    justifyContent: 'center', alignItems: 'center', ...SHADOW.md 
  },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  fomoBox: { flexDirection: 'row', alignItems: 'center', marginTop: 30, gap: 12 },
  avatarsRow: { flexDirection: 'row' },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },
  fomoText: { fontSize: 13, color: '#888', fontWeight: '600' },
  successView: { alignItems: 'center', paddingVertical: 20 },
  successIcon: { marginBottom: 25 },
  successTitle: { fontSize: 32, fontWeight: '900', color: '#1a1a1a' },
  successDesc: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 26, marginTop: 15, marginBottom: 30 },
  totalBadge: { backgroundColor: '#e0f2f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30 },
  totalText: { color: COLORS.teal, fontWeight: '700', fontSize: 14 },
  doneBtn: { marginTop: 40, width: 200, height: 54, borderRadius: 27, borderWidth: 2, borderColor: COLORS.teal, justifyContent: 'center', alignItems: 'center' },
  doneText: { color: COLORS.teal, fontWeight: '900', fontSize: 16 }
});
