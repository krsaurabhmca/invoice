import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { fontSizes } from "./theme";

// Utility function to format currency
const formatCurrency = (value) => {
  return `₹ ${parseFloat(value || 0).toFixed(2)}`;
};

// Utility function to format date (optional, if API doesn't return YYYY-MM-DD)
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return isNaN(date) ? dateString : date.toISOString().split("T")[0];
};

export default function InvoiceDetailScreen() {
  const { invoice_id } = useLocalSearchParams();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Fetch invoice details
  useEffect(() => {
    if (!invoice_id) {
      Alert.alert("Error", "No invoice ID provided.");
      setLoading(false);
      return;
    }

    const fetchInvoiceDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://offerplant.com/invoice/get_invoice_detail?invoice_id=${invoice_id}`
        );
        const data = await res.json();
        if (data.invoice && Array.isArray(data.items)) {
          setInvoice(data.invoice);
          setItems(data.items);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (e) {
        Alert.alert("Error", "Failed to load invoice details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetail();

    // Fade-in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [invoice_id]);

  // Calculate line total for each item
  const calculateLineTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const discount = parseFloat(item.discount || 0);
    const taxPercent = parseFloat(item.tax_percent || 0);
    const subtotal = quantity * unitPrice;
    const tax = ((subtotal - discount) * taxPercent) / 100;
    return (subtotal - discount + tax).toFixed(2);
  };

  const shareWhatsApp = () => {
    if (!invoice) return;
    const pdfLink = `https://offerplant.com/invoice/generate_invoice_pdf.php?invoice_id=${invoice.id}&user_id=${invoice.user_id}`;
    const due =
      (parseFloat(invoice.total_amount) || 0) -
      (parseFloat(invoice.total_paid) || 0);
    const message = `Invoice ${invoice.invoice_number}\nTotal: ₹${invoice.total_amount}\nPaid: ₹${invoice.total_paid}\nDue: ₹${due.toFixed(2)}\n${pdfLink}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading Invoice...</Text>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.loader}>
        <Text style={styles.loaderText}>No invoice found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerArea}>
          <Text style={styles.header}> #{invoice.invoice_number}</Text>
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              style={[styles.editBtn, { marginRight: 8 }]}
              onPress={() => shareWhatsApp()}
            >
              <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() =>
                router.push({
                  pathname: "/edit-invoice",
                  params: { invoice_id: invoice.id },
                })
              }
            >
              <Ionicons name="create-outline" size={24} color="#fff" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Invoice Info */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Invoice Number:</Text>
            <Text style={styles.value}>{invoice.invoice_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status:</Text>
            <View style={styles.statusContainer}>
              <Ionicons
                name={invoice.status === "paid" ? "checkmark-circle" : "alert-circle"}
                size={20}
                color={invoice.status === "paid" ? "#10b981" : "#facc15"}
                style={styles.statusIcon}
              />
              <Text
                style={[
                  styles.value,
                  { color: invoice.status === "paid" ? "#10b981" : "#facc15" },
                ]}
              >
                {invoice.status === "paid" ? "Paid" : "Unpaid"}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Invoice Date:</Text>
            <Text style={styles.value}>{formatDate(invoice.invoice_date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Due Date:</Text>
            <Text style={styles.value}>{formatDate(invoice.due_date)}</Text>
          </View>
        </Animated.View>

        {/* Client Details */}
        {invoice.client_name && (
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>Client Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{invoice.client_name}</Text>
            </View>
            {invoice.client_email && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{invoice.client_email}</Text>
              </View>
            )}
            {invoice.client_address && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Address:</Text>
                <Text style={styles.value}>{invoice.client_address}</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Items */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>No items found.</Text>
          ) : (
            items.map((item, idx) => (
              <View key={item.id || idx} style={styles.itemCard}>
                <Text style={styles.itemDesc}>{item.description}</Text>
                <View style={styles.itemRow}>
                  <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemMeta}>Unit: {formatCurrency(item.unit_price)}</Text>
                  <Text style={styles.itemMeta}>Disc: {formatCurrency(item.discount)}</Text>
                  <Text style={styles.itemMeta}>Tax: {item.tax_percent}%</Text>
                </View>
                <Text style={styles.itemTotal}>
                  Total: {formatCurrency(calculateLineTotal(item))}
                </Text>
              </View>
            ))
          )}
        </Animated.View>

        {/* Totals */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Subtotal:</Text>
            <Text style={styles.value}>
              {formatCurrency(
                items.reduce(
                  (sum, item) =>
                    sum + parseFloat(item.quantity) * parseFloat(item.unit_price),
                  0
                )
              )}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Total Discount:</Text>
            <Text style={styles.value}>
              {formatCurrency(
                items.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0)
              )}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Total Tax:</Text>
            <Text style={styles.value}>
              {formatCurrency(
                items.reduce(
                  (sum, item) =>
                    sum +
                    ((parseFloat(item.quantity) * parseFloat(item.unit_price) -
                      parseFloat(item.discount || 0)) *
                      parseFloat(item.tax_percent || 0)) /
                      100,
                  0
                )
              )}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Grand Total:</Text>
            <Text style={[styles.value, styles.grandTotal]}>
              {formatCurrency(invoice.total_amount)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Paid:</Text>
            <Text style={styles.value}>{formatCurrency(invoice.total_paid)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Due:</Text>
            <Text style={[styles.value, { color: "#ef4444" }]}>
              {formatCurrency(
                (parseFloat(invoice.total_amount) || 0) -
                  (parseFloat(invoice.total_paid) || 0)
              )}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
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
  scroll: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#18181b",
  },
  headerArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  header: {
    fontSize: fontSizes.header,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    flex: 1,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  card: {
    backgroundColor: "#23272f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    color: "#9ca3af",
    fontSize: 15,
    fontWeight: "500",
  },
  value: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    marginRight: 6,
  },
  grandTotal: {
    color: "#10b981",
    fontWeight: "700",
    fontSize: 16,
  },
  itemCard: {
    backgroundColor: "#2d3748",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  itemDesc: {
    color: "#38bdf8",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemMeta: {
    color: "#d1d5db",
    fontSize: 14,
  },
  itemTotal: {
    color: "#10b981",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 15,
    textAlign: "center",
    marginVertical: 10,
  },
});