import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Image } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, RADIUS, SHADOW } from '../utils/theme';
import axios from 'axios';

const Tab = createMaterialTopTabNavigator();

// --- EXPENSE TRACKER HEADER ---
const ExpenseTrackerHeader = ({ budgetState, theme }: any) => {
  if (!budgetState) return null;
  const isExceeding = budgetState.totalSpent > budgetState.totalBudget;
  const progress = Math.min(budgetState.totalSpent / budgetState.totalBudget, 1);

  return (
    <LinearGradient colors={[theme.card, theme.background]} style={styles.headerGlassmorphism}>
      <Text style={[styles.title, { color: theme.text }]}>Your EkalGo Premium Plan</Text>
      <View style={styles.progressRow}>
        <Text style={[styles.remainingText, { color: theme.textSecondary }]}>
          Remaining: ₹{budgetState.totalRemaining}
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: isExceeding ? '#FF5A5F' : theme.success }]} />
        </View>
      </View>
      
      {isExceeding && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={14} color="#FFF" />
          <Text style={styles.warningText}>You're exceeding your budget! Consider cheaper options.</Text>
        </View>
      )}
    </LinearGradient>
  );
};

// --- TAB COMPONENTS ---

const OverviewTab = ({ route }: any) => {
  const { data, theme } = route.params;
  return (
    <ScrollView style={[styles.tabContainer, { backgroundColor: theme.background }]}>
      <Text style={[styles.tabTitle, { color: theme.text }]}>Trip Overview</Text>
      <Text style={{ color: theme.textSecondary }}>Location: {data.location}</Text>
      <Text style={{ color: theme.textSecondary }}>Total Budget: ₹{data.budgetBreakdown.totalBudget}</Text>
    </ScrollView>
  );
};

const HotelsTab = ({ route }: any) => {
  const { data, theme } = route.params;
  return (
    <ScrollView style={[styles.tabContainer, { backgroundColor: theme.background }]}>
      {data.map((hotel: any, index: number) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{hotel.name}</Text>
          <Text style={{ color: theme.teal }}>₹{hotel.pricePerNight} / night</Text>
          <Text style={{ color: theme.textSecondary }}>Total: ₹{hotel.totalStayCost}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: theme.tealLight + '30' }]}>
              <Text style={[styles.tagText, { color: theme.teal }]}>{hotel.category}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: '#FFD70030' }]}>
              <Text style={[styles.tagText, { color: '#B8860B' }]}>⭐ {hotel.rating}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const FoodTab = ({ route }: any) => {
  const { data, theme } = route.params;
  return (
    <ScrollView style={[styles.tabContainer, { backgroundColor: theme.background }]}>
      {data.map((food: any, index: number) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{food.dishName}</Text>
          <Text style={{ color: theme.success, fontWeight: '800' }}>₹{food.averagePrice}</Text>
          <Text style={{ color: theme.textSecondary, marginTop: 5 }}>Famous at: {food.famousRestaurants.join(', ')}</Text>
          <View style={styles.tagRow}>
            {food.tags.map((tag: string, i: number) => (
              <View key={i} style={[styles.tag, { backgroundColor: theme.tealLight + '30' }]}>
                <Text style={[styles.tagText, { color: theme.teal }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const DailyPlanTab = ({ route }: any) => {
  const { data, theme } = route.params;
  return (
    <ScrollView style={[styles.tabContainer, { backgroundColor: theme.background }]}>
      {data.map((day: any) => (
        <View key={day.day} style={styles.dayCard}>
          <Text style={[styles.dayTitle, { color: theme.text }]}>Day {day.day} - {day.date}</Text>
          {day.spots.map((spot: any, index: number) => (
             <View key={index} style={styles.timelineItem}>
                <View style={[styles.timeLineIndicator, { backgroundColor: theme.teal }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.time, { color: theme.teal }]}>{spot.timeOfDay}</Text>
                  <Text style={[styles.place, { color: theme.text }]}>{spot.placeName}</Text>
                  <Text style={[styles.cost, { color: theme.success }]}>Cost: ₹{spot.cost}</Text>
                  
                  {index < day.spots.length - 1 && (
                    <Text style={[styles.travelInfo, { color: theme.textSecondary }]}>
                      🚗 {spot.distanceFromPrevious} • {spot.travelTimeMins} mins travel
                    </Text>
                  )}
                </View>
             </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

export default function PremiumTripScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  
  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState<any>(null);

  useEffect(() => {
    fetchPremiumPlan();
  }, []);

  const fetchPremiumPlan = async () => {
    try {
      const { budget, days, location, lat, lng } = route.params || {};
      
      // We will point to the local backend URL based on environment.
      // Usually axios setup with baseURL is used. Here we use full path or assume proxy.
      const response = await axios.post('http://192.168.1.10:5001/api/itinerary/premium', {
        totalBudget: budget || 25000,
        days: days || 3,
        location: location || 'Mumbai',
        lat,
        lng
      });
      
      setTripData(response.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate your premium plan.');
      console.error(e);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading || !tripData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.teal} />
        <Text style={{ color: theme.text, marginTop: 20 }}>Curating your premium experience...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
      
      <ExpenseTrackerHeader budgetState={tripData.budgetBreakdown} theme={theme} />

      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: theme.teal,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarIndicatorStyle: { backgroundColor: theme.teal, height: 3 },
          tabBarStyle: { backgroundColor: theme.card, elevation: 0, shadowOpacity: 0 },
          tabBarLabelStyle: { fontWeight: 'bold', textTransform: 'none' }
        }}
      >
        <Tab.Screen name="Overview" component={OverviewTab} initialParams={{ data: tripData, theme }} />
        <Tab.Screen name="Hotels" component={HotelsTab} initialParams={{ data: tripData.recommendations.hotels, theme }} />
        <Tab.Screen name="Food" component={FoodTab} initialParams={{ data: tripData.recommendations.food, theme }} />
        <Tab.Screen name="Daily Plan" component={DailyPlanTab} initialParams={{ data: tripData.dailyPlan, theme }} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { position: 'absolute', top: 50, left: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  headerGlassmorphism: { paddingTop: 100, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, ...SHADOW.lg },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 15 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remainingText: { fontSize: 14, fontWeight: '700' },
  progressBarBg: { flex: 1, height: 10, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 5, marginLeft: 15 },
  progressBarFill: { height: '100%', borderRadius: 5 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF5A5F', padding: 10, borderRadius: 10, marginTop: 15 },
  warningText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  tabContainer: { flex: 1, padding: 20 },
  tabTitle: { fontSize: 20, fontWeight: '800', marginBottom: 15 },
  card: { padding: 15, borderRadius: RADIUS.lg, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, fontWeight: '700' },
  dayCard: { marginBottom: 25 },
  dayTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15 },
  timelineItem: { flexDirection: 'row', marginBottom: 20 },
  timeLineIndicator: { width: 12, height: 12, borderRadius: 6, marginTop: 5, marginRight: 15 },
  time: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  place: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  cost: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  travelInfo: { fontSize: 12, marginTop: 5 }
});
