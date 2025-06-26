import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
  Animated,
} from "react-native";

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
  const [itemFadeAnims, setItemFadeAnims] = useState<Animated.Value[]>([]);
  const { invoice_id } = useLocalSearchParams();
  const router = useRouter();

 useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `https://offerplant.com/invoice/get_invoice_detail?invoice_id=${invoice_id}`
        );
        const data = await res.json();
        setClientId(data.invoice?.client_id?.toString() || "");
        setInvoiceNumber(data.invoice?.invoice_number || "");
        setInvoiceDate(data.invoice?.invoice_date ? new Date(data.invoice.invoice_date) : new Date());
        setDueDate(data.invoice?.due_date ? new Date(data.invoice.due_date) : new Date());
        // Each item should have .id, description, quantity, unit_price, discount, tax_percent
        setItems(data.items?.map(i => ({
          id: i.id,
          description: i.description || "",
          quantity: i.quantity?.toString() || "1",
          unit_price: i.unit_price?.toString() || "0",
          discount: i.discount?.toString() || "0",
          tax_percent: i.tax_percent?.toString() || "0",
        })) || []);
      } catch (err) {
        Alert.alert("Error", "Failed to fetch invoice details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [invoice_id]);

  // Fetch clients
  useEffect(() => {
    (async () => {
      const userJson = await AsyncStorage.getItem("user");
      const user = userJson ? JSON.parse(userJson) : null;
      setUserId(user?.id);
      if (user?.id) {
        const res = await fetch(
          `https://offerplant.com/invoice/get_clients.php?user_id=${user.id}`
        );
        const data = await res.json();
        setClients(data);
      }
    })();
  }, []);

  // Render loading spinner until data loaded
   if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#18181b", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  // Derived totals
  const getTotals = () => {
    let subtotal = 0, totalDiscount = 0, totalTax = 0;
    items.forEach((item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unit_price) || 0;
      const d = parseFloat(item.discount) || 0;
      const t = parseFloat(item.tax_percent) || 0;
      const lineTotal = q * p;
      subtotal += lineTotal;
      totalDiscount += d * q;
      totalTax += ((lineTotal - d * q) * t) / 100;
    });
    const grandTotal = subtotal - totalDiscount + totalTax;
    return {
      subtotal: subtotal.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalTax: totalTax.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
    };
  };



  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: "",
        quantity: "1",
        unit_price: "0",
        discount: "0",
        tax_percent: "0",
      },
    ]);
  };

  const handleRemoveItem = (idx) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  // Refresh item animations whenever the items array changes
  useEffect(() => {
    setItemFadeAnims(items.map(() => new Animated.Value(0)));
  }, [items]);

  useEffect(() => {
    itemFadeAnims.forEach((anim) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    });
  }, [itemFadeAnims]);

  const handleChangeItem = (idx, key, value) => {
    const newItems = [...items];
    newItems[idx][key] = value;
    setItems(newItems);
  };

  const handleDateChange = (setter) => (e, selectedDate) => {
    if (selectedDate) setter(selectedDate);
  };

  const validateFields = () => {
    if (!clientId || !invoiceNumber || !invoiceDate || !dueDate) {
      Alert.alert("Error", "All invoice fields are required.");
      return false;
    }
    if (!items.every((i) => i.description && i.quantity && i.unit_price)) {
      Alert.alert("Error", "Please fill in all item fields.");
      return false;
    }
    return true;
  };

   const handleSubmit = async () => {
    if (!validateFields()) return;
    setLoading(true);
    try {
      const { grandTotal } = getTotals();
      const payload = {
        user_id: userId,
        invoice_id: invoice_id,
        client_id: clientId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        total: parseFloat(grandTotal),
        items: items.map((i) => ({
          id: i.id, // important for backend to update correct item!
          description: i.description,
          quantity: parseInt(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          discount: parseFloat(i.discount) || 0,
          tax_percent: parseFloat(i.tax_percent) || 0,
        })),
      };
      console.log(payload);
      const response = await fetch(
        "https://offerplant.com/invoice/update_invoice.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
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
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const totals = getTotals();

  // Build out the rest of the form using your CreateInvoiceScreen logic,
  // pre-filled with the data loaded above. On submit, POST to update_invoice.php

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#18181b" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Edit Invoice</Text>
        {/* CLIENT & INVOICE DETAILS */}
        <View style={styles.card}>
          <Text style={styles.label}>Client</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={clientId}
              onValueChange={setClientId}
              style={{ color: "#fff", flex: 1, height: 38 }}
              dropdownIconColor="#fff"
            >
              <Picker.Item label="Select Client" value="" />
              {clients.map((client) => (
                <Picker.Item
                  key={client.id}
                  label={client.name}
                  value={client.id}
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
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Invoice Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowInvoiceDate(true)}
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
                  display="default"
                  onChange={(e, d) => {
                    setShowInvoiceDate(false);
                    if (d) setInvoiceDate(d);
                  }}
                />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Due Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDueDate(true)}
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
                  display="default"
                  onChange={(e, d) => {
                    setShowDueDate(false);
                    if (d) setDueDate(d);
                  }}
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
                onChangeText={(val) =>
                  handleChangeItem(idx, "description", val)
                }
              />
              <TouchableOpacity
                onPress={() => handleRemoveItem(idx)}
                disabled={items.length === 1}
                style={{ marginLeft: 8, opacity: items.length === 1 ? 0.5 : 1 }}
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
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                placeholder="Unit Price"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                value={item.unit_price}
                onChangeText={(val) => handleChangeItem(idx, "unit_price", val)}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                placeholder="Discount"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                value={item.discount}
                onChangeText={(val) => handleChangeItem(idx, "discount", val)}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                placeholder="Tax %"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                value={item.tax_percent}
                onChangeText={(val) => handleChangeItem(idx, "tax_percent", val)}
              />
            </View>
          </Animated.View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={handleAddItem}>
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
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={loading}
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
    padding: 18,
    paddingBottom: 32,
    backgroundColor: "#18181b",
    minHeight: "100%",
  },
  header: {
    fontSize: 28,
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
  pickerWrap: {
    backgroundColor: "#18181b",
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
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

