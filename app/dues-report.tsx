import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { fontSizes } from "./theme";

export default function DuesReportScreen() {
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [expandedPayments, setExpandedPayments] = useState({});
  const router = useRouter();

  // Load user and dues report
  const fetchDuesReport = async () => {
    try {
      const userJson = await AsyncStorage.getItem("user");
      const userData = userJson ? JSON.parse(userJson) : null;
      if (!userData?.id) throw new Error("No user ID found");
      setUser(userData);

      const res = await fetch(`https://offerplant.com/invoice/dues_report.php?user_id=${userData.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setInvoices(data);
      } else {
        throw new Error("Invalid response from dues report");
      }
    } catch (e) {
      Alert.alert("Error", e.message || "Could not load dues report.");
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    }
  };

  useEffect(() => {
    fetchDuesReport();
  }, []);

  // Toggle payments section
  const togglePayments = (invoiceId) => {
    setExpandedPayments((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  // Download and save PDF
  const downloadInvoice = async (invoiceId) => {
    try {
      const formData = new FormData();
      formData.append("invoice_id", invoiceId);
      formData.append("user_id", user.id);

      const res = await fetch("https://offerplant.com/invoice/generate_invoice_pdf.php", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.status !== "success") {
        throw new Error(data.message || "Failed to generate PDF");
      }

      const pdfUri = `${FileSystem.documentDirectory}invoice_${invoiceId}.pdf`;
      await FileSystem.downloadAsync(data.pdf_url, pdfUri);
      Alert.alert("Success", `Invoice downloaded to ${pdfUri}`);
      return pdfUri;
    } catch (e) {
      Alert.alert("Error", e.message || "Could not download invoice.");
    }
  };

  // View PDF
  const viewInvoice = async (invoiceId) => {
    try {
      const pdfUri = `${FileSystem.documentDirectory}invoice_${invoiceId}.pdf`;
      const fileInfo = await FileSystem.getInfoAsync(pdfUri);

      if (!fileInfo.exists) {
        Alert.alert("Info", "Invoice not downloaded yet. Downloading now...");
        const downloadedUri = await downloadInvoice(invoiceId);
        if (!downloadedUri) return;
      }

      await WebBrowser.openBrowserAsync(pdfUri);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not view invoice.");
    }
  };

  // Share PDF
  const shareInvoice = async (invoiceId) => {
    try {
      const pdfUri = `${FileSystem.documentDirectory}invoice_${invoiceId}.pdf`;
      const fileInfo = await FileSystem.getInfoAsync(pdfUri);

      if (!fileInfo.exists) {
        Alert.alert("Info", "Invoice not downloaded yet. Downloading now...");
        const downloadedUri = await downloadInvoice(invoiceId);
        if (!downloadedUri) return;
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Invoice",
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      Alert.alert("Error", e.message || "Could not share invoice.");
    }
  };

  // Cancel invoice
  const cancelInvoice = async (invoiceId, invoiceNumber) => {
    Alert.alert(
      "Confirm Cancellation",
      `Are you sure you want to cancel invoice ${invoiceNumber}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              const formData = new FormData();
              formData.append("invoice_id", invoiceId);
              formData.append("user_id", user.id);

              const res = await fetch("https://offerplant.com/invoice/cancel_invoice.php", {
                method: "POST",
                body: formData,
              });
              const data = await res.json();
              if (data.status === "success") {
                Alert.alert("Success", "Invoice cancelled successfully");
                await fetchDuesReport(); // Refresh dues report
              } else {
                throw new Error(data.message || "Failed to cancel invoice");
              }
            } catch (e) {
              Alert.alert("Error", e.message || "Could not cancel invoice.");
            }
          },
        },
      ]
    );
  };

  const renderInvoice = ({ item }) => (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      <View style={styles.invoiceInfo}>
        <Text style={styles.invoiceTitle}>{item.invoice_number}</Text>
        <Text style={styles.invoiceDetail}>Client: {item.client_name}</Text>
        <Text style={styles.invoiceDetail}>Date: {item.invoice_date}</Text>
        <Text style={styles.invoiceDetail}>Due Date: {item.due_date}</Text>
        <Text style={styles.invoiceDetail}>Total: ₹{Number(item.total_amount).toFixed(2)}</Text>
        <Text style={styles.invoiceDetail}>Paid: ₹{Number(item.total_paid).toFixed(2)}</Text>
        <Text style={[styles.invoiceDetail, { color: "#ef4444" }]}>Due: ₹{Number(item.due).toFixed(2)}</Text>
        <Text
          style={[
            styles.invoiceDetail,
            {
              color: item.status === "unpaid" ? "#ef4444" : "#22c55e",
            },
          ]}
        >
          Status: {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
        {item.payments && item.payments.length > 0 && (
          <TouchableOpacity onPress={() => togglePayments(item.invoice_id)} style={styles.paymentsToggle}>
            <Text style={styles.paymentsToggleText}>
              {expandedPayments[item.invoice_id] ? "Hide Payments" : "Show Payments"}
            </Text>
            <Ionicons
              name={expandedPayments[item.invoice_id] ? "chevron-up" : "chevron-down"}
              size={16}
              color="#38bdf8"
            />
          </TouchableOpacity>
        )}
        {expandedPayments[item.invoice_id] && item.payments && item.payments.length > 0 && (
          <View style={styles.paymentsContainer}>
            {item.payments.map((payment, index) => (
              <View key={index} style={styles.paymentItem}>
                <Text style={styles.paymentDetail}>Date: {payment.payment_date}</Text>
                <Text style={styles.paymentDetail}>Amount: ₹{Number(payment.amount).toFixed(2)}</Text>
                <Text style={styles.paymentDetail}>Mode: {payment.mode}</Text>
                {payment.notes && <Text style={styles.paymentDetail}>Notes: {payment.notes}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => downloadInvoice(item.invoice_id)}>
          <Ionicons name="download-outline" size={20} color="#38bdf8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => viewInvoice(item.invoice_id)}>
          <Ionicons name="eye-outline" size={20} color="#facc15" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => shareInvoice(item.invoice_id)}>
          <Ionicons name="share-outline" size={20} color="#f59e0b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => cancelInvoice(item.invoice_id, item.invoice_number)}
          disabled={item.status !== "unpaid"}
        >
          <Ionicons
            name="close-circle-outline"
            size={20}
            color={item.status === "unpaid" ? "#ef4444" : "#6b7280"}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dues Report</Text>
      </Animated.View>

      {/* Invoice List */}
      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.invoice_id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No dues found.</Text>}
      />

      {/* Create Invoice Button */}
      <TouchableOpacity
        style={[styles.actionBtn, styles.createBtn]}
        onPress={() => router.push("/create-invoice")}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.actionBtnText}>Create Invoice</Text>
      </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 40,
    backgroundColor: "#23272f",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.header,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#23272f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceInfo: {
    flex: 3,
  },
  invoiceTitle: {
    color: "#facc15",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  invoiceDetail: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 2,
  },
  paymentsToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  paymentsToggleText: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  paymentsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#1f252d",
    borderRadius: 8,
  },
  paymentItem: {
    marginBottom: 8,
  },
  paymentDetail: {
    color: "#d1d5db",
    fontSize: 12,
  },
  actions: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: 8,
    marginLeft: 8,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#38bdf8",
    paddingVertical: 14,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
});