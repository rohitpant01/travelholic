import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW, RADIUS, SPACING } from '../utils/theme';

interface Props {
  data: any;
  onUnlock: () => void;
}

export default function ItineraryTeaser({ data, onUnlock }: Props) {
  if (!data || !data.itinerary) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
         <View style={styles.header}>
            <View>
               <Text style={styles.destName}>{data.destination}</Text>
               <Text style={styles.teaserBadge}>Exclusive Preview</Text>
            </View>
            <View style={styles.costBox}>
               <Text style={styles.costLabel}>Est. Budget</Text>
               <Text style={styles.costVal}>{data.estimated_total_cost || '--'}</Text>
            </View>
         </View>

         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
            {data.itinerary.map((day: any, idx: number) => (
              <View key={idx} style={styles.dayColumn}>
                 <Text style={styles.dayTitle}>{day.day}</Text>
                 {day.plan.map((item: any, pIdx: number) => (
                    <View key={pIdx} style={styles.planItem}>
                       <View style={styles.timeLine}>
                          <View style={styles.dot} />
                          <View style={styles.line} />
                       </View>
                       <View style={styles.planContent}>
                          <Text style={styles.timeText}>{item.time}</Text>
                          <Text style={styles.placeName}>{item.place}</Text>
                          <Text style={styles.placeDesc} numberOfLines={2}>{item.description}</Text>
                       </View>
                    </View>
                 ))}
              </View>
            ))}

            {/* 🔒 BLURRED DAY 3 TEASER */}
            <TouchableOpacity style={styles.lockedDay} activeOpacity={0.8} onPress={onUnlock}>
                <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.blurOverlay} />
                <View style={styles.lockContainer}>
                   <View style={styles.lockIconBox}>
                      <Ionicons name="lock-closed" size={24} color="#fff" />
                   </View>
                   <Text style={styles.lockTitle}>Day 3 & Beyond</Text>
                   <Text style={styles.lockSubtitle}>Unlock 5+ More Days</Text>
                </View>
            </TouchableOpacity>
         </ScrollView>

         <View style={styles.featuresHook}>
            <View style={styles.hookItem}>
               <Ionicons name="location" size={18} color={COLORS.teal} />
               <Text style={styles.hookText}>Hidden Gems 🔒</Text>
            </View>
            <View style={styles.hookItem}>
               <Ionicons name="navigate" size={18} color={COLORS.teal} />
               <Text style={styles.hookText}>Optimized Routes 🔒</Text>
            </View>
            <View style={styles.hookItem}>
               <Ionicons name="restaurant" size={18} color={COLORS.teal} />
               <Text style={styles.hookText}>Local Food Guide 🔒</Text>
            </View>
         </View>

         <TouchableOpacity style={styles.unlockBtn} onPress={onUnlock}>
            <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.unlockGrad} start={{x:0, y:0}} end={{x:1, y:0}}>
               <Text style={styles.unlockBtnText}>Unlock Full 7-Day Itinerary 🚀</Text>
            </LinearGradient>
         </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 30 },
  card: { 
    backgroundColor: '#fff', borderRadius: 30, padding: 40, 
    ...SHADOW.lg, borderWidth: 1, borderColor: '#eee' 
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  destName: { fontSize: 32, fontWeight: '900', color: '#1a1a1a' },
  teaserBadge: { 
    alignSelf: 'flex-start', backgroundColor: '#f0f4f8', color: COLORS.teal, 
    fontSize: 12, fontWeight: '800', textTransform: 'uppercase', 
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, marginTop: 8 
  },
  costBox: { alignItems: 'flex-end' },
  costLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  costVal: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginTop: 4 },
  daysScroll: { paddingBottom: 20 },
  dayColumn: { width: 350, marginRight: 40 },
  dayTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 25 },
  planItem: { flexDirection: 'row', gap: 20, marginBottom: 25 },
  timeLine: { alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.teal, borderWidth: 3, borderColor: '#e0f2f1' },
  line: { flex: 1, width: 2, backgroundColor: '#f0f0f0', marginVertical: 5 },
  planContent: { flex: 1 },
  timeText: { fontSize: 13, color: COLORS.teal, fontWeight: '700', marginBottom: 4 },
  placeName: { fontSize: 17, fontWeight: '700', color: '#333' },
  placeDesc: { fontSize: 14, color: '#777', lineHeight: 22, marginTop: 6 },
  lockedDay: { 
    width: 300, height: 260, borderRadius: 25, backgroundColor: '#f8f9fa', 
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#ddd' 
  },
  blurOverlay: { ...StyleSheet.absoluteFillObject },
  lockContainer: { alignItems: 'center', zIndex: 5 },
  lockIconBox: { 
     width: 54, height: 54, borderRadius: 27, backgroundColor: '#1a1a1a', 
     alignItems: 'center', justifyContent: 'center', marginBottom: 15 
  },
  lockTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  lockSubtitle: { fontSize: 14, color: '#777', marginTop: 5 },
  featuresHook: { 
    flexDirection: 'row', gap: 30, marginTop: 40, paddingVertical: 30, 
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f5f5f5' 
  },
  hookItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hookText: { fontSize: 15, color: '#555', fontWeight: '600' },
  unlockBtn: { marginTop: 40, borderRadius: 20, overflow: 'hidden' },
  unlockGrad: { paddingVertical: 20, alignItems: 'center' },
  unlockBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' }
});
