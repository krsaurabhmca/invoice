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
import { fonts, fontSizes } from "./theme";

const USER_STORAGE_KEY = "user";

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

// Custom timeout function for fetch
const fetchWithTimeout = async (url: string, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  }
};

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnims, setFadeAnims] = useState<Animated.Value[]>([]);
  const [actionAnims, setActionAnims] = useState<Animated.Value[]>([]);
  const router = useRouter();

  // Fetch user and dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userJson) {
        throw new Error("Session expired. Please log in again.");
      }
      const userData: User = JSON.parse(userJson);
      if (!userData.id) {
        throw new Error("Invalid user data. Please log in again.");
      }
      setUser(userData);

      const response = await fetchWithTimeout(
        `https://offerplant.com/invoice/get_dashboard.php?user_id=${userData.id}`,
        {},
        10000
      );
      const responseText = await response.text();
      console.log("API Response Status:", response.status);
      console.log("API Response Text:", responseText);

      if (!responseText) {
        throw new Error("Empty response from server");
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("JSON Parse Error:", jsonError);
        throw new Error("Invalid response format from server");
      }

      if (response.ok && data.status === "success") {
        setDashboard({
          total_invoices: parseInt(data.total_invoices) || 0,
          paid_invoices: parseInt(data.paid_invoices) || 0,
          unpaid_invoices: parseInt(data.unpaid_invoices) || 0,
          unpaid_amount: data.unpaid_amount || "0.00",
        });
        setFadeAnims([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
        setActionAnims(actions.map(() => new Animated.Value(0)));
      } else {
        throw new Error(data.message || "Failed to fetch dashboard data.");
      }
    } catch (e: any) {
      console.error("Dashboard error:", e);
      Alert.alert("Error", e.message || "Could not load dashboard data.", [
        { text: "Cancel" },
        { text: "Retry", onPress: fetchData },
        { text: "Login", onPress: () => router.replace("/login") },
      ]);
      setDashboard(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Staggered animations for stats and actions
  useEffect(() => {
    fadeAnims.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    });
    actionAnims.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      fadeAnims.forEach((anim) => anim.setValue(0));
      actionAnims.forEach((anim) => anim.setValue(0));
    };
  }, [fadeAnims, actionAnims]);

  // Button press animation
  const handlePressIn = useCallback((anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressOut = useCallback((anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Logout
  const handleLogout = useCallback(() => {
    const logoutAnim = new Animated.Value(1);
    handlePressIn(logoutAnim);
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel", onPress: () => handlePressOut(logoutAnim) },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          router.replace("/login");
        },
      },
    ]);
    return logoutAnim;
  }, [handlePressIn, handlePressOut, router]);

  if (loading && !refreshing) {
    return (
      <LinearGradient colors={["#18181b", "#23272f"]} style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading Dashboard...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#18181b", "#1e2229"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38bdf8"
              colors={["#38bdf8"]}
              progressBackgroundColor="#23272f"
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              accessible={true}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back-outline" size={24} color="#facc15" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              Welcome, {user?.name || "User"}!
            </Text>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                const anim = handleLogout();
                return anim;
              }}
              accessible={true}
              accessibilityLabel="Log out"
              accessibilityRole="button"
            >
              {/* <Animated.View style={{ transform: [{ scale: handleLogout() }] }}> */}
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              {/* </Animated.View> */}
            </TouchableOpacity>
          </View>

          {/* Stats */}
          {dashboard ? (
            <View style={styles.statsContainer}>
              {[
                { icon: statIcons.total, value: dashboard.total_invoices, label: "Total Invoices" },
                { icon: statIcons.paid, value: dashboard.paid_invoices, label: "Paid Invoices", color: "#22c55e" },
                { icon: statIcons.unpaid, value: dashboard.unpaid_invoices, label: "Unpaid Invoices", color: "#ef4444" },
                { icon: statIcons.amount, value: `₹${dashboard.unpaid_amount}`, label: "Unpaid Amount", color: "#ef4444" },
              ].map((stat, index) => (
                <Animated.View
                  key={stat.label}
                  style={[styles.statCard, { opacity: fadeAnims[index] || 1 }]}
                >
                  <LinearGradient
                    colors={["#23272f", "#2a2e36"]}
                    style={styles.statCardInner}
                  >
                    <Ionicons
                      name={stat.icon}
                      size={32}
                      color={stat.color || "#38bdf8"}
                      style={styles.statIcon}
                    />
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </LinearGradient>
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No data available</Text>
              <Text style={styles.emptySubText}>Try refreshing or logging in again</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={fetchData}
                accessible={true}
                accessibilityLabel="Retry loading data"
                accessibilityRole="button"
              >
                <Text style={styles.emptyBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progress Bar */}
          {dashboard && (
            <View style={styles.progressWrapper}>
              <LinearGradient
                colors={["#2a2e36", "#2a2e36"]}
                style={styles.progressTrack}
              >
                <LinearGradient
                  colors={["#22c55e", "#38bdf8"]}
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
              </LinearGradient>
              <Text style={styles.progressText}>
                {dashboard.paid_invoices}/{dashboard.total_invoices} invoices paid
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {actions.map((action, index) => {
              const scaleAnim = actionAnims[index] || new Animated.Value(1);
              return (
                <TouchableOpacity
                  key={action.label}
                  style={styles.actionButton}
                  onPressIn={() => handlePressIn(scaleAnim)}
                  onPressOut={() => handlePressOut(scaleAnim)}
                  onPress={() => router.push(action.route)}
                  accessible={true}
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                >
                  <Animated.View style={[styles.actionButtonInner, { opacity: actionAnims[index] || 1, transform: [{ scale: scaleAnim }] }]}>
                    <Ionicons name={action.icon} size={24} color="#fff" />
                    <Text style={styles.actionLabel}>{action.label}</Text>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
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
    paddingTop: 20,
    paddingBottom: 80,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    color: "#e0e7ef",
    fontSize: 16,
    marginTop: 12,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: fontSizes.header || 24,
    fontWeight: "700",
    color: "#facc15",
    fontFamily: fonts.mono,
    textAlign: "center",
    flex: 1,
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
    marginBottom: 12,
  },
  statCardInner: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    elevation: 3,
  },
  statIcon: {
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    padding: 20,
  },
  emptyText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    elevation: 2,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  progressWrapper: {
    marginBottom: 24,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: 10,
    borderRadius: 5,
  },
  progressText: {
    marginTop: 10,
    color: "#e0e7ef",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  actionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionButton: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    elevation: 3,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 12,
  },
});