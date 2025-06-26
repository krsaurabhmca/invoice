import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useState } from "react";
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

// Utility function for date formatting (YYYY-MM-DD)
const formatDate = (date) => {
  return date.toISOString().split("T")[0];
};

// Utility function for generating invoice number
const generateInvoiceNumber = (userId) => {
  const date = new Date();
  const datePrefix = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date
    .getDate()
    .toString()
    .padStart(2, "0")}`;
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `INV-${datePrefix}-${userId || "UNKNOWN"}-${sequence}`;
};

export default function CreateInvoiceScreen() {
  // State
  const [userId, setUserId] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date());
  const [showInvoiceDate, setShowInvoiceDate] = useState(false);
  const [showDueDate, setShowDueDate] = useState(false);
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: "1",
    unit_price: "0",
    discount: "0",
    tax: "0",
  });
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [itemFadeAnims, setItemFadeAnims] = useState<Animated.Value[]>([]);

  // Load user_id, clients, and generate invoice number
  useEffect(() => {
    (async () => {
      try {
        const userJson = await AsyncStorage.getItem("user");
        const user = userJson ? JSON.parse(userJson) : null;
        setUserId(user?.id);
        if (user?.id) {
          const res = await fetch(
            `https://offerplant.com/invoice/get_clients.php?user_id=${user.id}`
          );
          const data = await res.json();
          setClients(Array.isArray(data) ? data : []);
          setInvoiceNumber(generateInvoiceNumber(user.id));
        }
      } catch (e) {
        Alert.alert("Error", "Failed to load user info or clients. Please try again.");
      }
    })();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Calculate totals
  const getTotals = () => {
    let subtotal = 0,
      totalDiscount = 0,
      totalTax = 0;
    items.forEach((item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unit_price) || 0;
      const d = parseFloat(item.discount) || 0;
      const t = parseFloat(item.tax) || 0;
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

  // Handle item addition
  const handleAddItem = () => {
    if (!newItem.description || !newItem.quantity || !newItem.unit_price) {
      Alert.alert("Missing Info", "Please fill in description, quantity, and unit price.");
      return;
    }
    setItems([...items, { ...newItem }]);
    setNewItem({ description: "", quantity: "1", unit_price: "0", discount: "0", tax: "0" });
  };

  // Handle item removal
  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Refresh item fade animations whenever items change
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

  // Handle new item input changes
  const handleChangeNewItem = (key, value) => {
    setNewItem({ ...newItem, [key]: value });
  };

  // Validate form
  const validateFields = () => {
    if (!clientId || !invoiceNumber || !invoiceDate || !dueDate) {
      Alert.alert("Missing Info", "Please fill out all invoice details, including client and dates.");
      return false;
    }
    if (items.length === 0 || !items.every((i) => i.description && i.quantity && i.unit_price)) {
      Alert.alert("Incomplete Items", "Please add at least one item with complete details.");
      return false;
    }
    return true;
  };

  // Submit invoice
  const handleSubmit = async () => {
    if (!validateFields()) return;
    setLoading(true);
    try {
      const { grandTotal } = getTotals();
      const payload = {
        user_id: userId,
        client_id: clientId,
        invoice_number: invoiceNumber,
        invoice_date: formatDate(invoiceDate),
        due_date: formatDate(dueDate),
        total: parseFloat(grandTotal),
        items: items.map((i) => ({
          description: i.description,
          quantity: parseInt(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          discount: parseFloat(i.discount) || 0,
          tax: parseFloat(i.tax) || 0,
        })),
      };
      const response = await fetch("https://offerplant.com/invoice/create_invoice.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok && data.status === "invoice_created") {
        Alert.alert("Success!", "Invoice created successfully! View it in your invoice list.");
        setInvoiceNumber(generateInvoiceNumber(userId));
        setInvoiceDate(new Date());
        setDueDate(new Date());
        setItems([]);
        setClientId("");
      } else {
        const msg = data.message || "Something went wrong while creating the invoice.";
        Alert.alert("Failed to Create", msg);
      }
    } catch (e) {
      Alert.alert("Connection Issue", "Couldn't connect to the server. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  const totals = getTotals();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Text style={styles.header}>Create New Invoice</Text>

        {/* Client & Invoice Details */}
        <View style={styles.card}>
          {/* Client Picker */}
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={24} color="#10b981" style={styles.icon} />
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={clientId}
                onValueChange={setClientId}
                style={styles.picker}
                dropdownIconColor="#f8fafc"
                itemStyle={styles.pickerItem}
              >
                <Picker.Item label="Select a Client" value="" />
                {clients.map((client) => (
                  <Picker.Item key={client.id} label={client.name} value={client.id} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Invoice Number */}
          <View style={styles.inputRow}>
            <Ionicons name="document-text-outline" size={24} color="#3b82f6" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Invoice Number"
              placeholderTextColor="#94a3b8"
              value={invoiceNumber}
              editable={false}
            />
          </View>

          {/* Dates */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.inputRow}>
                <Ionicons name="calendar" size={24} color="#f59e0b" style={styles.icon} />
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowInvoiceDate(true)}
                >
                  <Text style={styles.dateText}>{formatDate(invoiceDate)}</Text>
                </TouchableOpacity>
              </View>
              {showInvoiceDate && (
                <DateTimePicker
                  value={invoiceDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(e, d) => {
                    setShowInvoiceDate(Platform.OS === "ios");
                    if (d) setInvoiceDate(d);
                  }}
                />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.inputRow}>
                <Ionicons name="calendar" size={24} color="#ef4444" style={styles.icon} />
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDueDate(true)}
                >
                  <Text style={styles.dateText}>{formatDate(dueDate)}</Text>
                </TouchableOpacity>
              </View>
              {showDueDate && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(e, d) => {
                    setShowDueDate(Platform.OS === "ios");
                    if (d) setDueDate(d);
                  }}
                />
              )}
            </View>
          </View>
        </View>

        {/* Invoice Items */}
        <Text style={styles.sectionHeader}>Invoice Items</Text>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>No items added. Add an item below.</Text>
        ) : (
          items.map((item, idx) => (
            <Animated.View
              key={idx}
              style={[styles.itemCard, { opacity: itemFadeAnims[idx] || 1 }]}
            >
              <View style={styles.itemRow}>
                <Ionicons name="cube-outline" size={24} color="#8b5cf6" style={styles.icon} />
                <Text style={styles.itemText}>{item.description}</Text>
                <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={{ marginLeft: 12 }}>
                  <Ionicons name="trash-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.itemSubText}>
                Qty: {item.quantity} | Price: ₹{item.unit_price} | Disc: ₹{item.discount} | Tax: {item.tax}%
              </Text>
            </Animated.View>
          ))
        )}

        {/* Add Item Form */}
        <View style={styles.itemCard}>
          <View style={styles.inputRow}>
            <Ionicons name="cube-outline" size={24} color="#8b5cf6" style={styles.icon} />
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Item Description"
              placeholderTextColor="#94a3b8"
              value={newItem.description}
              onChangeText={(val) => handleChangeNewItem("description", val)}
              autoCapitalize="sentences"
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Qty"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newItem.quantity}
              onChangeText={(val) => handleChangeNewItem("quantity", val)}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
              placeholder="Unit Price"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newItem.unit_price}
              onChangeText={(val) => handleChangeNewItem("unit_price", val)}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
              placeholder="Discount"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newItem.discount}
              onChangeText={(val) => handleChangeNewItem("discount", val)}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
              placeholder="Tax %"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newItem.tax}
              onChangeText={(val) => handleChangeNewItem("tax", val)}
            />
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddItem}>
            <Ionicons name="add-circle" size={24} color="#10b981" style={styles.buttonIcon} />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsText}>Subtotal: ₹ {totals.subtotal}</Text>
          <Text style={styles.totalsText}>Discount: ₹ {totals.totalDiscount}</Text>
          <Text style={styles.totalsText}>Tax: ₹ {totals.totalTax}</Text>
          <Text style={styles.totalsTextBig}>Grand Total: ₹ {totals.grandTotal}</Text>
        </View>

        {/* Submit Button */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color="#fff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.submitBtnText}>Create Invoice</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scroll: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
    backgroundColor: "#0f172a",
  },
  header: {
    fontSize: 32,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2d3748",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  icon: {
    marginRight: 8,
  },
  pickerWrap: {
    flex: 1,
    backgroundColor: "transparent",
  },
  picker: {
    color: "#f8fafc",
    height: 48,
    fontSize: 16,
  },
  pickerItem: {
    color: "#000",
    fontSize: 16,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 16,
    paddingVertical: 0,
  },
  dateInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2d3748",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  dateText: {
    color: "#f8fafc",
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8fafc",
    marginVertical: 16,
  },
  itemCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  itemText: {
    flex: 2,
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "500",
  },
  itemSubText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#2d3748",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 12,
  },
  addBtnText: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  totalsCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalsText: {
    color: "#d1d5db",
    fontSize: 16,
    marginBottom: 4,
  },
  totalsTextBig: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
});
