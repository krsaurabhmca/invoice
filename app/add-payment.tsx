import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fontSizes } from "./theme";

export default function AddPaymentScreen() {
  const { invoice_id } = useLocalSearchParams();
  const router = useRouter();

  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("UPI");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || !mode) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        invoice_id: invoice_id,
        payment_date: paymentDate.toISOString().split("T")[0],
        amount: parseFloat(amount),
        mode,
        notes,
      };
      const response = await fetch("https://offerplant.com/invoice/add_payment.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok && data.status === "payment_added") {
        Alert.alert("Success", "Payment recorded successfully.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        const msg = data.message || "Failed to record payment.";
        Alert.alert("Error", msg);
      }
    } catch (e) {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#18181b" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Ionicons name="arrow-back-outline" size={24} color="#facc15" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Payment</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Payment Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" color="#7dd3fc" size={18} />
            <Text style={styles.dateText}>
              {paymentDate.toISOString().split("T")[0]}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={paymentDate}
              mode="date"
              display="default"
              onChange={(e, d) => {
                setShowDatePicker(false);
                if (d) setPaymentDate(d);
              }}
            />
          )}

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="Amount"
            placeholderTextColor="#cbd5e1"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Mode</Text>
          <TextInput
            style={styles.input}
            placeholder="Payment mode (e.g., UPI, Cash, Bank)"
            placeholderTextColor="#cbd5e1"
            value={mode}
            onChangeText={setMode}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { height: 60 }]}
            placeholder="Notes"
            placeholderTextColor="#cbd5e1"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Add Payment</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 18,
    paddingBottom: 32,
    backgroundColor: "#18181b",
    minHeight: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: fontSizes.header,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    flex: 1,
  },
  header: {
    fontSize: fontSizes.header,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#23272f",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
    label: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 2,
  },
  input: {
    backgroundColor: "#18181b",
    color: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    height: 44,
    fontSize: 15,
    marginBottom: 12,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    height: 44,
    marginBottom: 10,
    marginRight: 4,
  },
  dateText: {
    color: "#fff",
    marginLeft: 6,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: "#3b82f6",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
    elevation: 2,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 0.2,
  },
});
