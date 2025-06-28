import { Ionicons } from "@expo/vector-icons";
import { networkErrorMessage } from "./utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fontSizes } from "./theme";
import { SafeAreaView } from "react-native-safe-area-context";

const USER_STORAGE_KEY = "@invoiceApp:user";

interface Profile {
  name: string;
  email: string;
  phone: string;
  company_name: string;
  gst_number: string;
  bank_details: string;
  logo: { uri: string } | null;
}

const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone: string): boolean => /^[0-9]{10}$/.test(phone);
const validateGST = (gst: string): boolean =>
  gst ? /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst) : true;

export default function UpdateProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    gst_number: "",
    bank_details: "",
    logo: null,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [cardAnim] = useState(new Animated.Value(50));
  const router = useRouter();

  // Fetch user and profile
  const fetchData = useCallback(async () => {
    try {
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) {
        throw new Error("Session expired. Please log in again.");
      }
      const user = JSON.parse(userJson);
      if (!user?.id) {
        throw new Error("Invalid user data. Please log in again.");
      }
      setUserId(user.id);

      const res = await fetch(`https://offerplant.com/invoice/get_profile.php?user_id=${user.id}`);
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setProfile({
          name: data.profile.name || "",
          email: data.profile.email || "",
          phone: data.profile.phone || "",
          company_name: data.profile.company_name || "",
          gst_number: data.profile.gst_number || "",
          bank_details: data.profile.bank_details || "",
          logo: data.profile.logo ? { uri: `https://offerplant.com/invoice/uploads/${data.profile.logo}` } : null,
        });
      } else {
        throw new Error(data.message || "Failed to load profile.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message, [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(cardAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Handle image picker
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const fileSize = result.assets[0].fileSize || 0;
      if (fileSize > 2 * 1024 * 1024) {
        Alert.alert("Error", "Image size exceeds 2MB limit.");
        return;
      }
      setProfile({ ...profile, logo: result.assets[0] });
    }
  };

  // Clear logo
  const clearLogo = () => {
    setProfile({ ...profile, logo: null });
  };

  // Upload logo
  const uploadLogo = async (): Promise<string | null> => {
    if (!profile.logo || profile.logo.uri.startsWith("http")) {
      return profile.logo ? profile.logo.uri.replace("https://offerplant.com/invoice/uploads/", "") : null;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("user_id", userId!);
      formData.append("logo", {
        uri: profile.logo.uri,
        name: `logo_user_${userId}_${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);

      const response = await fetch("https://offerplant.com/invoice/upload_logo.php", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (response.ok && data.status === "success") {
        return data.logo_path;
      } else {
        throw new Error(data.message || "Failed to upload logo.");
      }
    } catch (e: any) {
      throw new Error(e.message || "Could not upload logo.");
    } finally {
      setUploading(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!profile.name) newErrors.name = "Name is required";
    if (!profile.email || !validateEmail(profile.email)) newErrors.email = "Enter a valid email";
    if (!profile.phone || !validatePhone(profile.phone)) newErrors.phone = "Enter a valid 10-digit phone number";
    if (profile.gst_number && !validateGST(profile.gst_number)) newErrors.gst_number = "Enter a valid GST number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert("Error", "Please correct the errors in the form.");
      return;
    }

    Alert.alert("Confirm", "Are you sure you want to update your profile?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Update",
        onPress: async () => {
          setSubmitting(true);
          try {
            const logoPath = await uploadLogo();

            const payload = {
              user_id: userId,
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              company_name: profile.company_name,
              gst_number: profile.gst_number,
              bank_details: profile.bank_details,
              logo: logoPath || "",
            };

            const response = await fetch("https://offerplant.com/invoice/update_profile.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (response.ok && data.status === "success") {
              const updatedUser = {
                id: userId,
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                company_name: profile.company_name,
                gst_number: profile.gst_number,
                bank_details: profile.bank_details,
                logo: logoPath ? `https://offerplant.com/invoice/uploads/${logoPath}` : null,
              };
              await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
              Alert.alert("Success", "Profile updated successfully!", [
                { text: "OK", onPress: () => router.push("/dashboard") },
              ]);
            } else {
              Alert.alert("Error", data.message || "Failed to update profile.");
            }
          } catch (e: any) {
            Alert.alert("Error", networkErrorMessage(e));
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading Profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient colors={["#18181b", "#23272f"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />
            }
          >
            {/* Header */}
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
              <TouchableOpacity onPress={() => router.push("/dashboard")} style={styles.backButton}>
                <Ionicons name="arrow-back-outline" size={24} color="#facc15" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Update Profile</Text>
              <View style={{ width: 24 }} /> {/* Spacer */}
            </Animated.View>

            {/* Profile Form */}
            <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: cardAnim }] }]}>
              {/* Logo Upload */}
              <View style={styles.imageContainer}>
                <TouchableOpacity onPress={pickImage} style={styles.imagePicker} disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#38bdf8" />
                  ) : profile.logo ? (
                    <Image source={profile.logo} style={styles.logoImage} />
                  ) : (
                    <Ionicons name="image-outline" size={40} color="#9ca3af" />
                  )}
                </TouchableOpacity>
                <View style={styles.imageButtons}>
                  <TouchableOpacity onPress={pickImage} style={styles.imageButton} disabled={uploading}>
                    <Text style={styles.imageButtonText}>Upload Logo</Text>
                  </TouchableOpacity>
                  {profile.logo && (
                    <TouchableOpacity onPress={clearLogo} style={[styles.imageButton, styles.clearImageButton]} disabled={uploading}>
                      <Text style={[styles.imageButtonText, styles.clearImageButtonText]}>Clear Logo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Form Fields */}
              <View style={[styles.inputRow, errors.name && styles.inputError]}>
                <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor="#9ca3af"
                  value={profile.name}
                  onChangeText={(text) => setProfile({ ...profile, name: text })}
                  accessibilityLabel="Name"
                />
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

              <View style={[styles.inputRow, errors.email && styles.inputError]}>
                <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#9ca3af"
                  value={profile.email}
                  onChangeText={(text) => setProfile({ ...profile, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  accessibilityLabel="Email"
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

              <View style={[styles.inputRow, errors.phone && styles.inputError]}>
                <Ionicons name="call-outline" size={20} color="#9ca3af" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor="#9ca3af"
                  value={profile.phone}
                  onChangeText={(text) => setProfile({ ...profile, phone: text })}
                  keyboardType="numeric"
                  accessibilityLabel="Phone number"
                />
              </View>
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

              <View style={styles.inputRow}>
                <Ionicons name="business-outline" size={20} color="#9ca3af" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Company Name (optional)"
                  placeholderTextColor="#9ca3af"
                  value={profile.company_name}
                  onChangeText={(text) => setProfile({ ...profile, company_name: text })}
                  accessibilityLabel="Company name"
                />
              </View>

              <View style={[styles.inputRow, errors.gst_number && styles.inputError]}>
                <Ionicons name="document-text-outline" size={20} color="#9ca3af" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="GST Number (optional)"
                  placeholderTextColor="#9ca3af"
                  value={profile.gst_number}
                  onChangeText={(text) => setProfile({ ...profile, gst_number: text })}
                  autoCapitalize="characters"
                  accessibilityLabel="GST number"
                />
              </View>
              {errors.gst_number && <Text style={styles.errorText}>{errors.gst_number}</Text>}

              <View style={styles.inputRow}>
                <Ionicons name="card-outline" size={20} color="#9ca3af" style={styles.icon} />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Bank Details (optional)"
                  placeholderTextColor="#9ca3af"
                  value={profile.bank_details}
                  onChangeText={(text) => setProfile({ ...profile, bank_details: text })}
                  multiline
                  accessibilityLabel="Bank details"
                />
              </View>
            </Animated.View>

            {/* Save Button */}
            <Animated.View style={[styles.buttonRow, { opacity: fadeAnim }]}>
              <TouchableOpacity
                style={[styles.button, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting || uploading}
                accessibilityLabel="Save profile"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save Profile</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loader: {
    flex: 1,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: "#9ca3af",
    fontSize: 16,
    marginTop: 8,
  },
  scroll: {
    padding: 16,
    paddingTop: 40,
    paddingBottom: 80,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: fontSizes.header,
    fontWeight: "700",
    color: "#facc15",
  },
  backButton: {
    padding: 8,
  },
  card: {
    backgroundColor: "#23272f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#1f252d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  imageButtons: {
    flexDirection: "row",
    marginTop: 12,
  },
  imageButton: {
    backgroundColor: "#38bdf8",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  clearImageButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  imageButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  clearImageButtonText: {
    color: "#ef4444",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f252d",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
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
  multilineInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 16,
  },
  buttonRow: {
    marginTop: 16,
  },
  button: {
    backgroundColor: "#38bdf8",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
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