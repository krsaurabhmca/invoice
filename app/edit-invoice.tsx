import { Ionicons } from "@expo/vector-icons";
import { networkErrorMessage } from "./utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

// Custom timeout function for fetch
const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
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

export default function EditInvoiceScreen() {
  const [userId, setUserId] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date());
  const [showInvoiceDate, setShowInvoiceDate] = useState(false);
  const [showDueDate, setShowDueDate] = useState(false);
  const [items, setItems] = useState([
    {
      description: "",
      quantity: "1",
      unit_price: "0",
      discount: "0",
      tax_percent: "0",
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [itemFadeAnims, setItemFadeAnims] = useState([]);
  const { invoice_id } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        const userJson = await AsyncStorage.getItem("user");
        const user = userJson ? JSON.parse(userJson) : null;
        if (!user?.id) {
          Alert.alert("Error", "User not found. Please log in again.");
          return;
        }
        setUserId(user.id);

        const [invoiceRes, clientsRes] = await Promise.all([
          fetchWithTimeout(
            `https://offerplant.com/invoice/get_invoice_detail?invoice_id=${invoice_id}`,
            {},
            10000
          ),
          fetchWithTimeout(
            `https://offerplant.com/invoice/get_clients.php?user_id=${user.id}`,
            {},
            10000
          ),
        ]);

        const invoiceData = await invoiceRes.json();
        const clientsData = await clientsRes.json();

        if (!invoiceRes.ok || !invoiceData?.invoice) {
          throw new Error("Invalid invoice data");
        }
        if (!clientsRes.ok || !Array.isArray(clientsData)) {
          throw new Error("Invalid clients data");
        }

        setClientId(invoiceData.invoice?.client_id?.toString() || "");
        setInvoiceNumber(invoiceData.invoice?.invoice_number || "");
        setInvoiceDate(
          invoiceData.invoice?.invoice_date
            ? new Date(invoiceData.invoice.invoice_date)
            : new Date()
        );
        setDueDate(
          invoiceData.invoice?.due_date
            ? new Date(invoiceData.invoice.due_date)
            : new Date()
        );
        setItems(
          invoiceData.items?.map((i) => ({
            id: i.id,
            description: i.description || "",
            quantity: i.quantity?.toString() || "1",
            unit_price: i.unit_price?.toString() || "0",
            discount: i.discount?.toString() || "0",
            tax_percent: i.tax_percent?.toString() || "0",
          })) || [
            {
              description: "",
              quantity: "1",
              unit_price: "0",
              discount: "0",
              tax_percent: "0",
            },
          ]
        );
        setClients(clientsData);
      } catch (err) {
        Alert.alert("Error", err.message || "Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [invoice_id]);

  const getTotals = useMemo(() => {
    let subtotal = 0,
      totalDiscount = 0,
      totalTax = 0;
    items.forEach((item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unit_price) || 0;
      const d = parseFloat(item.discount) || 0;
      const t = parseFloat(item.tax_percent) || 0;
      const lineTotal = q * p;
      subtotal += lineTotal;
      totalDiscount += d * q;
      totalTax += (lineTotal - d * q) * (t / 100);
    });
    const grandTotal = subtotal - totalDiscount + totalTax;
    return {
      subtotal: subtotal.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalTax: totalTax.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
    };
  }, [items]);

  const handleAddItem = useCallback(() => {
    const newItem = {
      description: "",
      quantity: "1",
      unit_price: "0",
      discount: "0",
      tax_percent: "0",
    };
    setItems((prev) => [...prev, newItem]);
    setItemFadeAnims((prev) => [...prev, new Animated.Value(0)]);
  }, []);

  const handleRemoveItem = useCallback(
    (idx) => {
      if (items.length === 1) {
        Alert.alert("Warning", "At least one item is required.");
        return;
      }
      setItems((prev) => prev.filter((_, i) => i !== idx));
      setItemFadeAnims((prev) => prev.filter((_, i) => i !== idx));
    },
    [items.length]
  );

  useEffect(() => {
    itemFadeAnims.forEach((anim) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      itemFadeAnims.forEach((anim) => anim.setValue(0));
    };
  }, [itemFadeAnims]);

  const handleChangeItem = useCallback((idx, key, value) => {
    if (["quantity", "unit_price", "discount", "tax_percent"].includes(key)) {
      if (value && !/^\d*\.?\d*$/.test(value)) {
        return; // Only allow valid numbers
      }
    }
    setItems((prev) => {
      const newItems = [...prev];
      newItems[idx][key] = value;
      return newItems;
    });
  }, []);

  const handleDateChange = useCallback(
    (setter, showSetter) => (e, selectedDate) => {
      showSetter(false);
      if (e.type !== "dismissed" && selectedDate) {
        setter(selectedDate);
      }
    },
    []
  );

  const validateFields = () => {
    if (!clientId) {
      Alert.alert("Error", "Please select a client.");
      return false;
    }
    if (!invoiceNumber) {
      Alert.alert("Error", "Please enter an invoice number.");
      return false;
    }
    if (!invoiceDate) {
      Alert.alert("Error", "Please select an invoice date.");
      return false;
    }
    if (!dueDate) {
      Alert.alert("Error", "Please select a due date.");
      return false;
    }
    if (
      !items.every(
        (i) =>
          i.description &&
          i.quantity &&
          parseFloat(i.quantity) > 0 &&
          i.unit_price &&
          parseFloat(i.unit_price) >= 0
      )
    ) {
      Alert.alert("Error", "All item fields must be filled with valid values.");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateFields()) return;
    setLoading(true);
    try {
      const { grandTotal } = getTotals;
      const payload = {
        user_id: userId,
        invoice_id: invoice_id,
        client_id: parseInt(clientId) || 0,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        total: parseFloat(grandTotal),
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          quantity: parseInt(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          discount: parseFloat(i.discount) || 0,
          tax_percent: parseFloat(i.tax_percent) || 0,
        })),
      };

      const response = await fetchWithTimeout(
        "https://offerplant.com/invoice/update_invoice.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        10000
      );
      const data = await response.json();

      if (response.ok && data.status === "invoice_updated") {
        Alert.alert("Success", "Invoice updated successfully.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        const msg = data.message || "Failed to update invoice.";
        Alert.alert("Error", msg);
      }
    } catch (e) {
      Alert.alert("Error", networkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const totals = getTotals;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#18181b" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8 }}
            accessible={true}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back-outline" size={24} color="#facc15" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Invoice</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* CLIENT & INVOICE DETAILS */}
        <View style={styles.card}>
          <Text style={styles.label}>Client Name</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={clientId}
              onValueChange={setClientId}
              style={{ color: "#fff", flex: 1, height: 38 }}
              dropdownIconColor="#fff"
              accessible={true}
              accessibilityLabel="Select client"
            >
              <Picker.Item label="Select Client" value="" />
              {clients.map((client) => (
                <Picker.Item
                  key={client.id}
                  label={client.name}
                  value={client.id.toString()}
                />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Invoice Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Invoice Number"
            placeholderTextColor="#cbd5e1"
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            accessible={true}
            accessibilityLabel="Invoice number"
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Invoice Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowInvoiceDate(true)}
                accessible={true}
                accessibilityLabel="Select invoice date"
              >
                <Ionicons name="calendar-outline" color="#7dd3fc" size={18} />
                <Text style={styles.dateText}>
                  {invoiceDate.toISOString().split("T")[0]}
                </Text>
              </TouchableOpacity>
              {showInvoiceDate && (
                <DateTimePicker
                  value={invoiceDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={handleDateChange(setInvoiceDate, setShowInvoiceDate)}
                />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Due Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDueDate(true)}
                accessible={true}
                accessibilityLabel="Select due date"
              >
                <Ionicons name="calendar-outline" color="#7dd3fc" size={18} />
                <Text style={styles.dateText}>
                  {dueDate.toISOString().split("T")[0]}
                </Text>
              </TouchableOpacity>
              {showDueDate && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={handleDateChange(setDueDate, setShowDueDate)}
                />
              )}
            </View>
          </View>
        </View>

        {/* INVOICE ITEMS */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>
          Invoice Items
        </Text>
        {items.map((item, idx) => (
          <Animated.View
            key={idx}
            style={[styles.itemCard, { opacity: itemFadeAnims[idx] || 1 }]}
          >
            <View style={styles.itemRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="Description"
                placeholderTextColor="#cbd5e1"
                value={item.description}
                onChangeText={(val) => handleChangeItem(idx, "description", val)}
                accessible={true}
                accessibilityLabel={`Item ${idx + 1} description`}
              />
              <TouchableOpacity
                onPress={() => handleRemoveItem(idx)}
                disabled={items.length === 1}
                style={{ marginLeft: 8, opacity: items.length === 1 ? 0.5 : 1 }}
                accessible={true}
                accessibilityLabel={`Remove item ${idx + 1}`}
              >
                <Ionicons
                  name="remove-circle-outline"
                  color="#ef4444"
                  size={26}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.itemRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Qty"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                value={item.quantity}
                onChangeText={(val) => handleChangeItem(idx, "quantity", val)}
                accessible={true}
                accessibilityLabel={`Item ${idx + 1} quantity`}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                placeholder="Unit Price"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                value={item.unit_price}
                onChangeText={(val) => handleChangeItem(idx, "unit_price", val)}
                accessible={true}
                accessibilityLabel={`Item ${idx + 1} unit price`}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                placeholder="Discount"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                value={item.discount}
                onChangeText={(val) => handleChangeItem(idx, "discount", val)}
                accessible={true}
                accessibilityLabel={`Item ${idx + 1} discount`}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                placeholder="Tax %"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                value={item.tax_percent}
                onChangeText={(val) => handleChangeItem(idx, "tax_percent", val)}
                accessible={true}
                accessibilityLabel={`Item ${idx + 1} tax percent`}
              />
            </View>
          </Animated.View>
        ))}

        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleAddItem}
          accessible={true}
          accessibilityLabel="Add new item"
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color="#3b82f6"
            style={{ marginRight: 4 }}
          />
          <Text style={{ color: "#3b82f6", fontWeight: "bold", fontSize: 16 }}>
            Add Item
          </Text>
        </TouchableOpacity>

        {/* TOTALS */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsText}>Subtotal: ₹ {totals.subtotal}</Text>
          <Text style={styles.totalsText}>
            Discount: ₹ {totals.totalDiscount}
          </Text>
          <Text style={styles.totalsText}>Tax: ₹ {totals.totalTax}</Text>
          <Text style={styles.totalsTextBig}>
            Grand Total: ₹ {totals.grandTotal}
          </Text>
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.submitBtn, { opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
          accessible={true}
          accessibilityLabel="Update invoice"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Update Invoice</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop:40,
    padding: 18,
    paddingBottom: 32,
    backgroundColor: "#18181b",
    minHeight: "100%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: fontSizes.header,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    flex: 1,
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
  pickerWrap: {
    backgroundColor: "#18181b",
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
    height:55,
    padding:0,
  },
  input: {
    backgroundColor: "#18181b",
    color: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    height: 42,
    fontSize: 15,
    marginBottom: 6,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    height: 42,
    marginBottom: 6,
    marginRight: 4,
  },
  dateText: {
    color: "#fff",
    marginLeft: 6,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    marginTop: 6,
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 6,
  },
  itemCard: {
    backgroundColor: "#23272f",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    elevation: 1,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginVertical: 12,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  totalsCard: {
    backgroundColor: "#23272f",
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
    marginBottom: 12,
    elevation: 1,
  },
  totalsText: {
    color: "#e0e7ef",
    fontSize: 15,
    marginBottom: 2,
  },
  totalsTextBig: {
    color: "#38bdf8",
    fontSize: 17,
    fontWeight: "bold",
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: "#3b82f6",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    elevation: 2,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 0.2,
  },
});