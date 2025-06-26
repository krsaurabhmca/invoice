import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

export default function AddClientScreen() {
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gst, setGst] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [fadeAnim] = useState(new Animated.Value(0));
  const [cardAnim] = useState(new Animated.Value(50));
  const router = useRouter();

  // Load user_id and animate
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userJson = await AsyncStorage.getItem("user");
        const user = userJson ? JSON.parse(userJson) : null;
        if (!user?.id) {
          throw new Error("No user found. Please log in.");
        }
        setUserId(user.id);
      } catch (e) {
        Alert.alert("Error", "Couldn’t fetch user info. Please log in again.");
        router.replace("/login");
      }
    };

    loadUser();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  // Validation
  const validateForm = () => {
    const newErrors = {};
    if (!name) newErrors.name = "Business name is required";
    if (!email || !/\S+@\S+\.\S+/.test(email)) newErrors.email = "Valid email is required";
    if (!phone || !/^\d{10}$/.test(phone)) newErrors.phone = "10-digit phone number is required";
    if (!address) newErrors.address = "Address is required";
    if (!gst || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst))
      newErrors.gst = "Valid GST number is required (e.g., 22AAAAA0000A1Z5)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setGst("");
    setErrors({});
  };

  const handleAddClient = async () => {
    if (!validateForm()) {
      Alert.alert("Error", "Please correct the errors in the form.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("https://offerplant.com/invoice/add_client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, name, email, phone, address, gst }),
      });
      const data = await response.json();
      if (response.ok && data.status === "client_added") {
        Alert.alert("Success", "Client added successfully!", [
          { text: "OK", onPress: () => router.push("/dashboard") },
        ]);
        clearForm();
      } else {
        Alert.alert("Error", data.message || "Failed to add client.");
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#18181b", "#23272f"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: cardAnim }] }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.push("/dashboard")} style={styles.backButton}>
                <Ionicons name="arrow-back-outline" size={24} color="#facc15" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Add New Client</Text>
              <View style={{ width: 24 }} /> {/* Spacer */}
            </View>

            {/* Inputs */}
            <View style={[styles.inputRow, errors.name && styles.inputError]}>
              <Ionicons name="storefront-outline" size={20} color="#9ca3af" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Business Name"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                accessibilityLabel="Business Name input"
              />
            </View>
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            <View style={[styles.inputRow, errors.email && styles.inputError]}>
              <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Email input"
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            <View style={[styles.inputRow, errors.phone && styles.inputError]}>
              <Ionicons name="call-outline" size={20} color="#9ca3af" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#9ca3af"
                value={phone}
                onChangeText={setPhone}
                keyboardType="number-pad"
                maxLength={10}
                accessibilityLabel="Phone input"
              />
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

            <View style={[styles.inputRow, errors.address && styles.inputError]}>
              <Ionicons name="map-outline" size={20} color="#9ca3af" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Address"
                placeholderTextColor="#9ca3af"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="sentences"
                accessibilityLabel="Address input"
              />
            </View>
            {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

            <View style={[styles.inputRow, errors.gst && styles.inputError]}>
              <Ionicons name="document-text-outline" size={20} color="#9ca3af" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="GST Number"
                placeholderTextColor="#9ca3af"
                value={gst}
                onChangeText={(text) => setGst(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={15}
                accessibilityLabel="GST Number input"
              />
            </View>
            {errors.gst && <Text style={styles.errorText}>{errors.gst}</Text>}

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.clearButton, loading && styles.buttonDisabled]}
                onPress={clearForm}
                disabled={loading}
              >
                <Text style={[styles.buttonText, styles.clearButtonText]}>Clear Form</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleAddClient}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Add Client</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingTop: 40,
    minHeight: "100%",
  },
  card: {
    backgroundColor: "#23272f",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
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
  },
  backButton: {
    padding: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f252d",
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputError: {
    borderColor: "#ef4444",
    borderWidth: 2,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  button: {
    flex: 1,
    backgroundColor: "#38bdf8",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 8,
  },
  clearButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#9ca3af",
  },
  clearButtonText: {
    color: "#9ca3af",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});