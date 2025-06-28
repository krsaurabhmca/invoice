import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fontSizes } from "./theme";
import { networkErrorMessage } from "./utils";

const formatCurrency = (value) => {
  return `₹ ${parseFloat(value || 0).toFixed(2)}`;
};

// Utility function to format date (YYYY-MM-DD)
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return isNaN(date) ? dateString : date.toISOString().split("T")[0];
};

export default function PaymentPageScreen() {
  const [userId, setUserId] = useState(null);
  const [payments, setPayments] = useState([]);
  const [modeFilter, setModeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [fadeAnims, setFadeAnims] = useState<Animated.Value[]>([]);
  const [shakeAnim] = useState(new Animated.Value(0));
  const scrollViewRef = useRef<FlatList>(null);

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
        Alert.alert("Error", "Failed to load user information. Please log in again.", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
        setLoading(false);
      }
    })();
  }, []);

  // Fetch payments
  useEffect(() => {
    if (userId) {
      fetchPayments();
    }
  }, [userId]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://offerplant.com/invoice/get_payments.php?user_id=${userId}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayments(data);
        setFadeAnims(data.map(() => new Animated.Value(0)));
      } else {
        throw new Error("Invalid response format");
      }
    } catch (e) {
      Alert.alert("Error", networkErrorMessage(e));
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fadeAnims.forEach((anim) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    });
  }, [fadeAnims]);

  // Handle date selection
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios"); // Keep picker open on iOS until dismissed
    if (selectedDate) {
      setDateFilter(formatDate(selectedDate));
      setErrors((prev) => ({ ...prev, dateFilter: "" })); // Clear error on valid selection
    }
  };

  // Validate filters
  const validateFilters = () => {
    const newErrors: { [key: string]: string } = {};
    if (dateFilter && !/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
      newErrors.dateFilter = "Enter a valid date (YYYY-MM-DD)";
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
      scrollViewRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Apply filters
  const applyFilters = () => {
    if (validateFilters()) {
      // Filter logic is already handled by filteredPayments
      console.log("Filters applied:", { modeFilter, dateFilter });
    } else {
      Alert.alert("Error", "Please correct the date filter.");
    }
  };

  // Render payment card
  const renderPayment = ({ item, index }) => (
    <Animated.View style={[styles.card, { opacity: fadeAnims[index] || 1 }]}>
      <View style={styles.cardContent}>
        <View style={styles.infoSection}>
          <Text style={styles.invoiceNo}>Invoice #{item.invoice_number}</Text>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <Text style={styles.meta}>Date: {formatDate(item.payment_date)}</Text>
          <Text style={styles.meta}>Mode: {item.mode}</Text>
          {item.notes && <Text style={styles.notes}>Note: {item.notes}</Text>}
        </View>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            router.push({
              pathname: "/invoice-detail",
              params: { invoice_id: item.invoice_id },
            })
          }
          activeOpacity={0.8}
          accessibilityLabel={`View invoice ${item.invoice_number}`}
        >
          <Ionicons name="document-text-outline" size={18} color="#fff" />
          <Text style={styles.actionText}> Invoice</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const filteredPayments = payments.filter((p) => {
    const matchesMode = modeFilter
      ? p.mode.toLowerCase().includes(modeFilter.toLowerCase())
      : true;
    const matchesDate = dateFilter ? formatDate(p.payment_date) === dateFilter : true;
    return matchesMode && matchesDate;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading Payments...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerArea}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push("/dashboard")}
          activeOpacity={0.8}
          accessibilityLabel="Go back to dashboard"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.header}>Payment History</Text>
      </View>

      {/* Filters */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 }}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="Filter mode"
          placeholderTextColor="#9ca3af"
          value={modeFilter}
          onChangeText={setModeFilter}
          accessibilityLabel="Filter by payment mode"
        />
        <Animated.View style={[styles.input, { flex: 1, transform: [{ translateX: shakeAnim }] }, errors.dateFilter && styles.inputError]}>
          <TouchableOpacity
            style={{ flex: 1, justifyContent: "center" }}
            onPress={() => setShowDatePicker(true)}
            accessibilityLabel="Select date filter"
            accessibilityHint={errors.dateFilter ? `Error: ${errors.dateFilter}` : "Select a date in YYYY-MM-DD format"}
          >
            <Text style={[styles.inputText, !dateFilter && styles.placeholderText]}>
              {dateFilter || "YYYY-MM-DD"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      {errors.dateFilter && (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLabel={`Error: ${errors.dateFilter}`}
        >
          {errors.dateFilter}
        </Text>
      )}

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={dateFilter ? new Date(dateFilter) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={onDateChange}
          maximumDate={new Date()} // Restrict to past/present dates
          textColor="#fff" // Match theme
          style={Platform.OS === "ios" ? styles.iosDatePicker : null}
          accessibilityLabel="Date picker for filtering payments"
        />
      )}

      {/* Payment List */}
      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPayment}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPayments();
            }}
            colors={["#38bdf8"]}
          />
        }
        ref={scrollViewRef}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>No payments found.</Text>
            <Text style={styles.emptySubText}>Add a new payment to get started.</Text>
          </View>
        }
      />
      <Text style={styles.totalText}>
        Total: {formatCurrency(filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0))}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181b",
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
    alignItems: "center",
    padding: 20,
    paddingTop: 30,
    backgroundColor: "#18181b",
  },
  header: {
    fontSize: fontSizes.header,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    textAlign: "center",
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
  amount: {
    color: "#38bdf8",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  meta: {
    color: "#d1d5db",
    fontSize: 14,
    marginBottom: 2,
  },
  notes: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
    fontStyle: "italic",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
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
  input: {
    backgroundColor: "#23272f",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#334155",
    height: 40,
  },
  inputError: {
    borderColor: "#ef4444",
    borderWidth: 2,
  },
  inputText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  placeholderText: {
    color: "#9ca3af",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 20,
  },
  totalText: {
    color: "#38bdf8",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  iosDatePicker: {
    backgroundColor: "#23272f",
    borderRadius: 8,
    padding: 10,
  },
});