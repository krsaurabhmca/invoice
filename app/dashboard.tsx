import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts } from "./theme";

const USER_STORAGE_KEY = "@invoiceApp:user";

interface User {
  id: string;
  name: string;
}

interface DashboardData {
  total_invoices: number;
  paid_invoices: number;
  unpaid_invoices: number;
  unpaid_amount: string;
}

const statIcons = {
  total: "documents-outline",
  paid: "checkmark-circle-outline",
  unpaid: "alert-circle-outline",
  amount: "cash-outline",
};

const actions = [
  { label: "Add Client", icon: "person-add-outline", route: "/add-client" },
  { label: "Manage Clients", icon: "people-outline", route: "/manage-clients" },
  { label: "Create Invoice", icon: "document-text-outline", route: "/create-invoice" },
  { label: "View Invoices", icon: "list-outline", route: "/view-invoices" },
  { label: "View Payment", icon: "wallet-outline", route: "/view-payment" },
  { label: "Update Profile", icon: "person-outline", route: "/update-profile" },
  { label: "Dues Report", icon: "alert-circle-outline", route: "/dues-report" },
];

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const router = useRouter();

  // Fetch user and dashboard data
  const fetchData = useCallback(async () => {
    try {
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) {
        throw new Error("Session expired. Please log in again.");
      }
      const userData: User = JSON.parse(userJson);
      if (!userData.id) {
        throw new Error("Invalid user data. Please log in again.");
      }
      setUser(userData);

      const resp = await fetch(
        `https://offerplant.com/invoice/get_dashboard.php?user_id=${userData.id}`
      );
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP Error: ${resp.status}`);
      }
      const data = await resp.json();
      if (data.status !== "success") {
        throw new Error(data.message || "Failed to fetch dashboard data.");
      }
      setDashboard({
        total_invoices: parseInt(data.total_invoices) || 0,
        paid_invoices: parseInt(data.paid_invoices) || 0,
        unpaid_invoices: parseInt(data.unpaid_invoices) || 0,
        unpaid_amount: data.unpaid_amount || "0.00",
      });
    } catch (e: any) {
      console.error("Dashboard error:", e);
      Alert.alert("Error", e.message, [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
      setDashboard(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Logout
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          router.replace("/login");
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#18181b", "#23272f"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38bdf8"
            />
          }
        >
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <Text style={styles.headerTitle}>
              Welcome, {user?.name || "User"}!
            </Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </Animated.View>

          {/* Stats */}
          {dashboard && (
            <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
              <LinearGradient
                colors={["#23272f", "#2a2e36"]}
                style={styles.statCard}
              >
                <Ionicons
                  name={statIcons.total}
                  size={28}
                  color="#38bdf8"
                  style={styles.statIcon}
                />
                <Text style={styles.statValue}>{dashboard.total_invoices}</Text>
                <Text style={styles.statLabel}>Total Invoices</Text>
              </LinearGradient>
              <LinearGradient
                colors={["#23272f", "#2a2e36"]}
                style={styles.statCard}
              >
                <Ionicons
                  name={statIcons.paid}
                  size={28}
                  color="#22c55e"
                  style={styles.statIcon}
                />
                <Text style={styles.statValue}>{dashboard.paid_invoices}</Text>
                <Text style={styles.statLabel}>Paid Invoices</Text>
              </LinearGradient>
              <LinearGradient
                colors={["#23272f", "#2a2e36"]}
                style={styles.statCard}
              >
                <Ionicons
                  name={statIcons.unpaid}
                  size={28}
                  color="#ef4444"
                  style={styles.statIcon}
                />
                <Text style={styles.statValue}>{dashboard.unpaid_invoices}</Text>
                <Text style={styles.statLabel}>Unpaid Invoices</Text>
              </LinearGradient>
              <LinearGradient
                colors={["#23272f", "#2a2e36"]}
                style={styles.statCard}
              >
                <Ionicons
                  name={statIcons.amount}
                  size={28}
                  color="#ef4444"
                  style={styles.statIcon}
                />
                <Text style={styles.statValue}>₹{dashboard.unpaid_amount}</Text>
                <Text style={styles.statLabel}>Unpaid Amount</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {dashboard && (
        <View style={styles.progressWrapper}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    (dashboard.paid_invoices /
                      Math.max(dashboard.total_invoices, 1)) *
                    100
                  }%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {dashboard.paid_invoices}/{dashboard.total_invoices} invoices paid
          </Text>
        </View>
      )}

          {/* Actions */}
          <Animated.View style={[styles.actionsContainer, { opacity: fadeAnim }]}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.actionButton}
                onPress={() => router.push(action.route)}
                accessibilityLabel={action.label}
              >
                <Ionicons name={action.icon} size={24} color="#fff" />
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingTop: 40,
    paddingBottom: 80,
  },
  loader: {
    flex: 1,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    color: "#9ca3af",
    fontSize: 16,
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#facc15",
    fontFamily: fonts.mono,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  progressWrapper: {
    marginBottom: 24,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#2a2e36",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#22c55e",
  },
  progressText: {
    marginTop: 8,
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
  },
  actionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionButton: {
    width: "100%",
    backgroundColor: "#38bdf8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 12,
  },
});