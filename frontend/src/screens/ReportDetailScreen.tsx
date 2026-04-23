import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { userAPI } from '../api/services';

type ReportDetailScreenRouteProp = RouteProp<RootStackParamList, 'ReportDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ReportDetailScreen() {
  const route = useRoute<ReportDetailScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { reportId } = route.params;

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    try {
      const res = await userAPI.getMyReportDetails(reportId);
      setReport(res.data.report);
    } catch (err) {
      console.warn('Failed to fetch report details', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B'; // amber
      case 'reviewed': return '#3B82F6'; // blue
      case 'resolved': return '#10B981'; // green
      case 'dismissed': return '#ef4444'; // red
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF3A54" />
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Report not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MyReports')}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const snapshot = report.targetSnapshot;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MyReports')} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* STATUS CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Report Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                {report.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.infoText}>Reported on: {new Date(report.createdAt).toLocaleDateString()}</Text>
          <Text style={styles.infoText}>Reason: {report.reason.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.infoText}>Type: {report.type.toUpperCase()}</Text>
          
          {report.resolution && (
            <View style={styles.resolutionBox}>
              <Text style={styles.resolutionTitle}>Resolution:</Text>
              <Text style={styles.resolutionText}>{report.resolution.replace('_', ' ').toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* SNAPSHOT CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reported Content</Text>
          <Text style={styles.helperText}>This is a secure snapshot of the content at the time you reported it.</Text>

          {snapshot ? (
            <View style={styles.snapshotContainer}>
              {/* If User Snapshot */}
              {report.type === 'user' && (
                <View style={styles.userSnapshot}>
                  {snapshot.photo ? (
                    <Image source={{ uri: snapshot.photo }} style={styles.snapshotAvatar} blurRadius={report.status === 'resolved' ? 0 : 10} />
                  ) : (
                    <View style={styles.snapshotAvatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.snapshotUserInfo}>
                    <Text style={styles.snapshotName}>{snapshot.displayName}</Text>
                    <Text style={styles.snapshotUsername}>@{snapshot.username}</Text>
                    {snapshot.city && <Text style={styles.snapshotMeta}>{snapshot.city}</Text>}
                  </View>
                  {snapshot.bio && <Text style={styles.snapshotBio}>"{snapshot.bio}"</Text>}
                </View>
              )}

              {/* If Post or Comment Snapshot */}
              {(report.type === 'post' || report.type === 'comment') && (
                <View style={styles.postSnapshot}>
                  <View style={styles.postHeader}>
                    {snapshot.authorPhoto ? (
                      <Image source={{ uri: snapshot.authorPhoto }} style={styles.postAvatar} blurRadius={5} />
                    ) : (
                      <View style={styles.postAvatarPlaceholder} />
                    )}
                    <Text style={styles.postAuthor}>{snapshot.authorName}</Text>
                  </View>
                  {snapshot.text ? (
                    <Text style={styles.postText}>{snapshot.text}</Text>
                  ) : null}
                  {snapshot.images && snapshot.images.length > 0 && (
                    <Image source={{ uri: snapshot.images[0] }} style={styles.postImage} blurRadius={15} />
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noSnapshot}>
              <Ionicons name="document-outline" size={32} color="#D1D5DB" />
              <Text style={styles.noSnapshotText}>No snapshot available for this report.</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6'
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20
  },
  errorText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 20
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF3A54',
    borderRadius: 8
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 22
  },
  resolutionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981'
  },
  resolutionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4
  },
  resolutionText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500'
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20
  },
  snapshotContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  userSnapshot: {
    alignItems: 'center'
  },
  snapshotAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12
  },
  snapshotAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  snapshotUserInfo: {
    alignItems: 'center',
    marginBottom: 12
  },
  snapshotName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  snapshotUsername: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2
  },
  snapshotMeta: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4
  },
  snapshotBio: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 10
  },
  postSnapshot: {
    width: '100%'
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10
  },
  postAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 10
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827'
  },
  postText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#E5E7EB'
  },
  noSnapshot: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed'
  },
  noSnapshotText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center'
  }
});
