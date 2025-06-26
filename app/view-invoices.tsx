import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Utility function to format currency
const formatCurrency = (value) => {
  return `₹ ${parseFloat(value || 0).toFixed(2)}`;
};

export default function ManageInvoicesScreen() {
  const [userId, setUserId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnims = useState(invoices.map(() => new Animated.Value(0)))[0];

  // Load user_id
  useEffect(() => {
    (async () => {
      try {
        const userJson = await AsyncStorage.getItem("user");
        const user = userJson ? JSON.parse(userJson) : null;
        if (user?.id) {
          setUserId(user.id);
        } else {
          throw new Error("No user ID found");
        }
      } catch (e) {
        Alert.alert(
          "Error",
          "Failed to load user information. Please log in again."
        );
        setLoading(false);
      }
    })();
  }, []);

  // Fetch invoices
  useEffect(() => {
    if (userId) {
      fetchInvoices();
    }
  }, [userId]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://offerplant.com/invoice/get_invoices.php?user_id=${userId}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setInvoices(data);
        // Initialize fade animations
        fadeAnims.forEach((anim) => {
          Animated.timing(anim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }).start();
        });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (e) {
      Alert.alert("Error", "Could not load invoices. Please try again.");
      setInvoices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Render invoice card
  const renderInvoice = ({ item, index }) => (
    <Animated.View style={[styles.card, { opacity: fadeAnims[index] || 1 }]}>
      <View style={styles.cardContent}>
        <View style={styles.infoSection}>
          <Text style={styles.invoiceNo}>#{item.invoice_number}</Text>
          <Text style={styles.clientName}>
            {item.client_name || "Unknown Client"}
          </Text>
          <Text style={styles.amount}>{formatCurrency(item.total_amount)}</Text>
          <View style={styles.statusContainer}>
            <Ionicons
              name={
                item.status === "paid" ? "checkmark-circle" : "alert-circle"
              }
              size={20}
              color={item.status === "paid" ? "#10b981" : "#facc15"}
              style={styles.statusIcon}
            />
            <Text
              style={[
                styles.status,
                { color: item.status === "paid" ? "#10b981" : "#facc15" },
              ]}
            >
              {item.status === "paid" ? "Paid" : "Unpaid"}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}
            onPress={() =>
              router.push({
                pathname: "/invoice-detail",
                params: { invoice_id: item.id },
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: "#10b981", marginLeft: 8 },
            ]}
            onPress={() =>
              router.push({
                pathname: "/add-payment",
                params: { invoice_id: item.id },
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={styles.actionText}>Pay</Text>
          </TouchableOpacity>
          <Link
            href={`https://offerplant.com/invoice/generate_invoice_pdf.php?invoice_id=${item.id}&user_id=${userId}`}
            target="_blank"
            rel="noopener noreferrer"
          style={[
              styles.actionBtn,
              { backgroundColor: "#ffb011", marginLeft: 8, color:"#ffffff" },
            ]} >
               <Ionicons name="download" size={18} color="#fff" />
            <Text style={styles.actionText}> PDF </Text>
          </Link>
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading Invoices...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.header}>Manage Invoices</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push("/create-invoice")}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Invoice List */}
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderInvoice}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchInvoices();
            }}
            colors={["#38bdf8"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>No invoices found.</Text>
            <Text style={styles.emptySubText}>
              Create a new invoice to get started.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181b",
    paddingTop: 30,
  },
  loader: {
    flex: 1,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 10,
  },
  headerArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "#18181b",
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  list: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
    backgroundColor: "#18181b",
  },
  card: {
    backgroundColor: "#23272f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoSection: {
    flex: 1,
  },
  invoiceNo: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  clientName: {
    color: "#d1d5db",
    fontSize: 14,
    marginBottom: 4,
  },
  amount: {
    color: "#38bdf8",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusIcon: {
    marginRight: 6,
  },
  status: {
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 10,
  },
  emptySubText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 6,
  },
});
