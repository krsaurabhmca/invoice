import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Utility function to get client initials
const getInitials = (name) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function ManageClientsScreen() {
  const [userId, setUserId] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const [fadeAnims, setFadeAnims] = useState<Animated.Value[]>([]);

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
        Alert.alert("Error", "Failed to load user information.");
      }
    })();
  }, []);

  // Fetch clients
  useEffect(() => {
    if (userId) fetchClients();
  }, [userId]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://offerplant.com/invoice/get_clients.php?user_id=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setClients(data);
        setFadeAnims(data.map(() => new Animated.Value(0)));
      } else {
        throw new Error("Invalid response");
      }
    } catch (e) {
      Alert.alert("Error", "Could not load clients.");
      setClients([]);
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

  const handleDelete = (clientId) => {
    Alert.alert(
      "Delete Client",
      "Are you sure you want to delete this client?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteClient(clientId),
        },
      ],
      { cancelable: true }
    );
  };

  const deleteClient = async (clientId) => {
    try {
      const res = await fetch(
        `https://offerplant.com/invoice/delete_client.php?client_id=${clientId}`,
        { method: "GET" }
      );
      const data = await res.json();
      if (data.status === "success") {
        setClients((prev) => prev.filter((c) => c.id !== clientId));
        Alert.alert("Success", "Client deleted successfully.");
      } else {
        Alert.alert("Error", data.message || "Failed to delete client.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not delete client.");
    }
  };

  const handleEdit = (client) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/edit-client", params: { client: JSON.stringify(client) } });
  };

  const handleView = (client) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/client-detail", params: { client: JSON.stringify(client) } });
  };

  const renderClient = ({ item, index }) => (
    <Animated.View style={[styles.card, { opacity: fadeAnims[index] || 1 }]}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.9}
        onPress={() => handleView(item)}
        onLongPress={() => handleEdit(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.infoText}>
            Email: <Text style={styles.infoValue}>{item.email}</Text>
          </Text>
          <Text style={styles.infoText}>
            Phone: <Text style={styles.infoValue}>{item.phone}</Text>
          </Text>
          <Text style={styles.infoText}>
            Address: <Text style={styles.infoValue}>{item.address || "N/A"}</Text>
          </Text>
          <Text style={styles.infoText}>
            GST: <Text style={styles.infoValue}>{item.gst_number || "N/A"}</Text>
          </Text>
          <Text style={styles.created}>Added: {item.created_at}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={20} color="#38bdf8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loaderText}>Loading Clients...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Clients</Text>
        {/* <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/add-client");
          }}
          style={styles.addBtn}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addBtnText}>Add Client</Text>
        </TouchableOpacity> */}
      </View>

      {/* Client List */}
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderClient}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchClients();
            }}
            colors={["#38bdf8"]}
            tintColor="#38bdf8"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>No clients found</Text>
            <Text style={styles.emptySubText}>Add a new client to get started</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/add-client")}
            >
              <Text style={styles.emptyBtnText}>Add Client</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/add-client");
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
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
    padding:6,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  list: {
    padding: 16,
    paddingBottom: 80,
    backgroundColor: "#18181b",
  },
  card: {
    backgroundColor: "#23272f",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  info: {
    flex: 1,
  },
  name: {
    color: "#facc15",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  infoText: {
    color: "#d1d5db",
    fontSize: 14,
    marginBottom: 2,
  },
  infoValue: {
    color: "#fff",
    fontWeight: "500",
  },
  created: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    flexDirection: "column",
    justifyContent: "center",
    marginLeft: 12,
  },
  actionBtn: {
    backgroundColor: "#2d3748",
    borderRadius: 20,
    padding: 8,
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
  },
  emptyBtn: {
    backgroundColor: "#f59e0b",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#f59e0b",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});