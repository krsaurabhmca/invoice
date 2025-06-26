import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
} from "react-native";
import { fontSizes } from "./theme";

export default function EditClientScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const client = params.client ? JSON.parse(params.client) : {};
  const [userId, setUserId] = useState(null);

  const [name, setName] = useState(client.name || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [address, setAddress] = useState(client.address || "");
  const [gst, setGst] = useState(client.gst_number || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const userJson = await AsyncStorage.getItem("user");
      const user = userJson ? JSON.parse(userJson) : null;
      setUserId(user?.id);
    })();
  }, []);

  const validateEmail = (val) => /\S+@\S+\.\S+/.test(val);
  const validatePhone = (val) => /^\d{10}$/.test(val);

  const handleUpdateClient = async () => {
    if (!name || !email || !phone || !address || !gst) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email.");
      return;
    }
    if (!validatePhone(phone)) {
      Alert.alert("Error", "Please enter a 10-digit phone number.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("https://offerplant.com/invoice/update_client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          user_id: userId,
          name,
          email,
          phone,
          address,
          gst,
        }),
      });
      const data = await response.json();
      console.log(data);
      if (response.ok && data.status === "client_updated") {
        Alert.alert("Success", "Client updated successfully.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        const errorMessage = data.message || "Failed to update client.";
        Alert.alert("Error", errorMessage);
      }
    } catch (error) {
      Alert.alert("Error", "Network or server error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#18181b" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Edit Client</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Ionicons name="business-outline" size={20} color="#7dd3fc" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Business Name"
              placeholderTextColor="#cbd5e1"
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={20} color="#7dd3fc" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#cbd5e1"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={20} color="#7dd3fc" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#cbd5e1"
              value={phone}
              onChangeText={setPhone}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="location-outline" size={20} color="#7dd3fc" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Address"
              placeholderTextColor="#cbd5e1"
              value={address}
              onChangeText={setAddress}
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="card-outline" size={20} color="#7dd3fc" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="GST Number"
              placeholderTextColor="#cbd5e1"
              value={gst}
              onChangeText={setGst}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleUpdateClient}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="create-outline" size={20} color="#fff" style={{ marginRight: 7 }} />
                <Text style={styles.buttonText}>Update Client</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: "#18181b",
    minHeight: "100%",
  },
  header: {
    fontSize: fontSizes.header,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 22,
    alignSelf: "center",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#262626",
    borderRadius: 20,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "#334155",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#10b981",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    elevation: 2,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
