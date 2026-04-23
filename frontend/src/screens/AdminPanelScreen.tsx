import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, RefreshControl, FlatList
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootState } from '../store';
import { adminAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

type Tab = 'stats' | 'reports' | 'users' | 'logs';

interface StatsData {
  totalUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  pendingReports: number;
  totalReports: number;
  totalPosts: number;
  hiddenPosts: number;
}

export default function AdminPanelScreen() {
  const navigation = useNavigation<any>();
  const user = useSelector((state: RootState) => state.auth.user);
  const insets = useSafeAreaInsets();

  // ── Role Guard ───────────────────────────────────────────────
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!isAdmin) {
      // Silently navigate back — no error, no trace
      navigation.goBack();
    }
  }, [isAdmin]);

  if (!isAdmin) return null;

  // ── State ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportFilter, setReportFilter] = useState('pending');

  // ── Data Fetching ────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data);
    } catch (err) {
      console.warn('[ADMIN] Stats fetch failed:', err);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await adminAPI.getReports({ status: reportFilter, limit: 50 });
      setReports(res.data.reports || []);
    } catch (err) {
      console.warn('[ADMIN] Reports fetch failed:', err);
    }
  }, [reportFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminAPI.getUsers({ search: searchQuery, limit: 50 });
      setUsers(res.data.users || []);
    } catch (err) {
      console.warn('[ADMIN] Users fetch failed:', err);
    }
  }, [searchQuery]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await adminAPI.getLogs({ limit: 50 });
      setLogs(res.data.logs || []);
    } catch (err) {
      console.warn('[ADMIN] Logs fetch failed:', err);
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'stats') await fetchStats();
      else if (activeTab === 'reports') await fetchReports();
      else if (activeTab === 'users') await fetchUsers();
      else if (activeTab === 'logs') await fetchLogs();
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchStats, fetchReports, fetchUsers, fetchLogs]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, reportFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTabData();
    setRefreshing(false);
  };

  // ── Admin Actions ────────────────────────────────────────────
  const handleResolveReport = (report: any) => {
    Alert.alert('Resolve Report', `Type: ${report.type}\nReason: ${report.reason}\nReporters: ${report.targetReportCount || 1}\nTrust: ${report.reportedBy?.trustScore ?? '?'}`, [
      { text: 'Dismiss', onPress: () => resolveReportAction(report._id, 'dismissed') },
      { text: 'Warn User', style: 'destructive', onPress: () => resolveReportAction(report._id, 'warned') },
      { text: 'Remove Content', style: 'destructive', onPress: () => resolveReportAction(report._id, 'content_removed') },
      { text: 'Suspend User', style: 'destructive', onPress: () => resolveReportAction(report._id, 'user_suspended') },
      { text: '🚫 Ban User', style: 'destructive', onPress: () => resolveReportAction(report._id, 'user_banned') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const resolveReportAction = async (id: string, resolution: string) => {
    try {
      await adminAPI.resolveReport(id, { resolution, adminNotes: `Resolved as ${resolution}` });
      Alert.alert('Done', 'Report resolved. Reporter has been notified.');
      fetchReports();
      fetchStats();
    } catch (err) {
      Alert.alert('Error', 'Failed to resolve report');
    }
  };

  const handleUserAction = (targetUser: any) => {
    const actions: any[] = [];

    if (targetUser.isBanned) {
      actions.push({ text: '✅ Unban (manual DB)', onPress: () => Alert.alert('Info', 'Unban requires direct DB update for safety') });
    } else if (targetUser.isSuspended) {
      actions.push({ text: '✅ Unsuspend', onPress: () => unsuspendUser(targetUser._id) });
    } else {
      actions.push({ text: '⚠️ Warn', style: 'destructive', onPress: () => warnUser(targetUser._id) });
      actions.push({ text: '🚫 Suspend', style: 'destructive', onPress: () => suspendUser(targetUser._id) });
      actions.push({ text: '❌ Ban', style: 'destructive', onPress: () => banUser(targetUser._id) });
    }

    if (isSuperAdmin && targetUser._id !== user?._id) {
      actions.push({ text: '👑 Change Role', onPress: () => handleRoleChange(targetUser) });
    }

    actions.push({ text: 'Cancel', style: 'cancel' });

    const subtitle = `@${targetUser.username} · Trust: ${targetUser.trustScore ?? 50}/100 · Warnings: ${targetUser.warningCount || 0}`;
    Alert.alert(`Manage ${targetUser.firstName}`, subtitle, actions);
  };

  const handleRoleChange = (targetUser: any) => {
    const roles = ['user', 'admin', 'superadmin'].filter(r => r !== targetUser.role);
    Alert.alert('Change Role', `Current: ${targetUser.role}`, [
      ...roles.map(r => ({
        text: `Set to ${r}`,
        onPress: () => changeRole(targetUser._id, r),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const suspendUser = async (id: string) => {
    try {
      const res = await adminAPI.suspendUser(id, { reason: 'Suspended via admin panel', days: 3 });
      Alert.alert('Done', res.data.message || 'User suspended');
      fetchUsers();
    } catch { Alert.alert('Error', 'Failed to suspend user'); }
  };

  const banUser = async (id: string) => {
    Alert.alert('Confirm Ban', 'This will permanently ban the user and remove all their content.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Ban', style: 'destructive', onPress: async () => {
        try {
          await adminAPI.banUser(id, 'Banned via admin panel');
          Alert.alert('Done', 'User permanently banned');
          fetchUsers();
        } catch { Alert.alert('Error', 'Failed to ban user'); }
      }}
    ]);
  };

  const unsuspendUser = async (id: string) => {
    try {
      await adminAPI.unsuspendUser(id);
      Alert.alert('Done', 'User unsuspended');
      fetchUsers();
    } catch { Alert.alert('Error', 'Failed to unsuspend user'); }
  };

  const warnUser = async (id: string) => {
    try {
      const res = await adminAPI.warnUser(id, 'Warning from admin');
      Alert.alert('Done', res.data.message);
      fetchUsers();
    } catch { Alert.alert('Error', 'Failed to warn user'); }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await adminAPI.changeUserRole(id, role);
      Alert.alert('Done', `Role updated to ${role}`);
      fetchUsers();
    } catch { Alert.alert('Error', 'Failed to change role'); }
  };

  // ── Renders ──────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <View>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <Text style={styles.headerSubtitle}>
          {isSuperAdmin ? '👑 Superadmin' : '🛡️ Admin'} · {user?.firstName}
        </Text>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabBar}>
      {([
        { key: 'stats', icon: 'stats-chart', label: 'Stats' },
        { key: 'reports', icon: 'flag', label: 'Reports' },
        { key: 'users', icon: 'people', label: 'Users' },
        { key: 'logs', icon: 'list', label: 'Logs' },
      ] as { key: Tab; icon: any; label: string }[]).map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Ionicons
            name={tab.icon}
            size={18}
            color={activeTab === tab.key ? COLORS.teal : COLORS.textLight}
          />
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStats = () => {
    if (!stats) return null;
    const cards = [
      { label: 'Total Users', value: stats.totalUsers, icon: 'people', color: COLORS.teal },
      { label: 'Suspended', value: stats.suspendedUsers, icon: 'ban', color: COLORS.error },
      { label: 'Banned', value: stats.bannedUsers || 0, icon: 'close-circle', color: '#E74C3C' },
      { label: 'Pending Reports', value: stats.pendingReports, icon: 'flag', color: COLORS.warning },
      { label: 'Total Reports', value: stats.totalReports, icon: 'document-text', color: COLORS.info },
      { label: 'Total Posts', value: stats.totalPosts, icon: 'newspaper', color: COLORS.orange },
      { label: 'Hidden/Review', value: stats.hiddenPosts || 0, icon: 'eye-off', color: '#9B59B6' },
    ];

    return (
      <View style={styles.statsGrid}>
        {cards.map(card => (
          <View key={card.label} style={[styles.statCard, { borderLeftColor: card.color }]}>
            <View style={styles.statCardHeader}>
              <Ionicons name={card.icon as any} size={20} color={card.color} />
              <Text style={styles.statValue}>{card.value}</Text>
            </View>
            <Text style={styles.statLabel}>{card.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderReports = () => (
    <View>
      <View style={styles.filterRow}>
        {['pending', 'resolved', 'ignored'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, reportFilter === f && styles.filterChipActive]}
            onPress={() => setReportFilter(f)}
          >
            <Text style={[styles.filterChipText, reportFilter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          <Text style={styles.emptyText}>No {reportFilter} reports</Text>
        </View>
      ) : (
        reports.map(report => (
          <TouchableOpacity
            key={report._id}
            style={styles.reportCard}
            onPress={() => handleResolveReport(report)}
            disabled={report.status === 'resolved'}
          >
            <View style={styles.reportHeader}>
              <View style={styles.reportHeaderLeft}>
                <View style={[styles.typeBadge, { backgroundColor: getReportTypeColor(report.type) }]}>
                  <Text style={styles.typeBadgeText}>{report.type}</Text>
                </View>
                {report.targetReportCount > 1 && (
                  <View style={[styles.typeBadge, { backgroundColor: '#E74C3C' }]}>
                    <Text style={styles.typeBadgeText}>{report.targetReportCount} reports</Text>
                  </View>
                )}
              </View>
              <Text style={styles.reportDate}>
                {new Date(report.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.reportReason} numberOfLines={2}>{report.reason}</Text>
            {report.details ? (
              <Text style={styles.reportDetails} numberOfLines={1}>{report.details}</Text>
            ) : null}
            {/* Content Preview */}
            {report.contentPreview && report.type === 'post' && (
              <View style={styles.contentPreview}>
                <Text style={styles.contentPreviewLabel}>Content:</Text>
                <Text style={styles.contentPreviewText} numberOfLines={2}>
                  {report.contentPreview.content || '[No text]'}
                </Text>
              </View>
            )}
            <View style={styles.reportFooter}>
              <Text style={styles.reportedBy}>
                By: @{report.reportedBy?.username || 'unknown'}
              </Text>
              <View style={[styles.trustBadge, { backgroundColor: getTrustColor(report.reportedBy?.trustScore) }]}>
                <Text style={styles.trustBadgeText}>T:{report.reportedBy?.trustScore ?? '?'}</Text>
              </View>
            </View>
            {report.status === 'resolved' && (
              <View style={styles.resolvedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.resolvedText}>{report.resolution}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderUsers = () => (
    <View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchUsers}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); fetchUsers(); }}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {users.map(u => (
        <TouchableOpacity
          key={u._id}
          style={styles.userCard}
          onPress={() => handleUserAction(u)}
        >
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {u.firstName?.[0]}{u.lastName?.[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.firstName} {u.lastName}</Text>
              <Text style={styles.userUsername}>@{u.username}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
            </View>
          </View>
            <View style={styles.userMeta}>
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor(u.role) }]}>
                <Text style={styles.roleBadgeText}>{u.role || 'user'}</Text>
              </View>
              <View style={[styles.trustBadge, { backgroundColor: getTrustColor(u.trustScore) }]}>
                <Text style={styles.trustBadgeText}>Trust: {u.trustScore ?? 50}</Text>
              </View>
              {u.isBanned && (
                <View style={[styles.roleBadge, { backgroundColor: '#1a1a2e' }]}>
                  <Text style={styles.roleBadgeText}>BANNED</Text>
                </View>
              )}
              {u.isSuspended && !u.isBanned && (
                <View style={[styles.roleBadge, { backgroundColor: COLORS.error }]}>
                  <Text style={styles.roleBadgeText}>
                    SUSPENDED{u.suspendedUntil ? ` until ${new Date(u.suspendedUntil).toLocaleDateString()}` : ''}
                  </Text>
                </View>
              )}
              {u.warningCount > 0 && (
                <Text style={styles.warningCount}>⚠️ {u.warningCount}</Text>
              )}
              {(u.violationHistory?.length || 0) > 0 && (
                <Text style={styles.warningCount}>🚩 {u.violationHistory.length}</Text>
              )}
            </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderLogs = () => (
    <View>
      {logs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No moderation logs yet</Text>
        </View>
      ) : (
        logs.map(log => (
          <View key={log._id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={[styles.actionBadge, { backgroundColor: getActionColor(log.action) }]}>
                <Text style={styles.actionBadgeText}>{formatAction(log.action)}</Text>
              </View>
              <Text style={styles.logDate}>
                {new Date(log.createdAt).toLocaleDateString()}{' '}
                {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.logAdmin}>
              By: {log.adminId?.firstName} {log.adminId?.lastName} (@{log.adminId?.username})
            </Text>
            {log.reason ? <Text style={styles.logReason}>{log.reason}</Text> : null}
          </View>
        ))
      )}
    </View>
  );

  // ── Main Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderTabs()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={COLORS.teal} />
          </View>
        ) : (
          <>
            {activeTab === 'stats' && renderStats()}
            {activeTab === 'reports' && renderReports()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'logs' && renderLogs()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ──────────────────────────────────────────────────
const getReportTypeColor = (type: string) => {
  switch (type) {
    case 'user': return '#E74C3C';
    case 'post': return '#3498DB';
    case 'comment': return '#9B59B6';
    case 'group': return '#F0A500';
    default: return '#95A5A6';
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'superadmin': return '#FFD700';
    case 'admin': return '#00B4B4';
    default: return '#94A3B8';
  }
};

const getActionColor = (action: string) => {
  if (action.includes('ban')) return '#1a1a2e';
  if (action.includes('suspend')) return '#E74C3C';
  if (action.includes('unsuspend')) return '#27AE60';
  if (action.includes('warn')) return '#F0A500';
  if (action.includes('delete') || action.includes('hide')) return '#E74C3C';
  if (action.includes('restore')) return '#27AE60';
  if (action.includes('promote')) return '#FFD700';
  if (action.includes('demote')) return '#95A5A6';
  if (action.includes('mass_report')) return '#9B59B6';
  if (action.includes('trust')) return '#3498DB';
  return '#3498DB';
};

const getTrustColor = (score?: number) => {
  if (score === undefined || score === null) return '#94A3B8';
  if (score >= 80) return '#27AE60';
  if (score >= 50) return '#3498DB';
  if (score >= 25) return '#F0A500';
  return '#E74C3C';
};

const formatAction = (action: string) => {
  return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    marginRight: SPACING.sm,
    padding: 4,
  },
  headerTitle: {
    fontSize: FONTS.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.teal,
  },
  tabText: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.teal,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  loaderContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  // ── Stats ──
  statsGrid: {
    gap: SPACING.sm,
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 4,
    ...SHADOW.sm,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statValue: {
    fontSize: FONTS.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  // ── Reports ──
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.borderLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.teal,
  },
  filterChipText: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.textWhite,
  },
  reportCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reportDate: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
  },
  reportReason: {
    fontSize: FONTS.md,
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  reportDetails: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  reportedBy: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  resolvedText: {
    fontSize: FONTS.xs,
    color: COLORS.success,
    fontWeight: '500',
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  trustBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  trustBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  contentPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  contentPreviewLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: 2,
  },
  contentPreviewText: {
    fontSize: FONTS.sm,
    color: COLORS.text,
  },
  // ── Users ──
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: FONTS.md,
    color: COLORS.text,
  },
  userCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.tealLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: FONTS.md,
    fontWeight: '700',
    color: COLORS.teal,
  },
  userName: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  userUsername: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
  },
  userEmail: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  roleBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  warningCount: {
    fontSize: FONTS.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
  // ── Logs ──
  logCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  actionBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  logDate: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
  },
  logAdmin: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
  },
  logReason: {
    fontSize: FONTS.sm,
    color: COLORS.text,
    marginTop: 4,
    fontStyle: 'italic',
  },
  // ── Empty ──
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.md,
    color: COLORS.textLight,
  },
});
