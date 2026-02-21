import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
    border: "#E5E5E5",
    card: "#FAFAFA",
    danger: "#EF4444",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    danger: "#F87171",
  },
};

export default function ExploreScreen() {
  const router = useRouter();
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of your portal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            // 1. Destroy the saved token
            await AsyncStorage.removeItem("userToken");

            // 2. Force the user back to the login screen
            router.replace("/login");
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>S</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Abu Sufian</Text>
            <Text style={styles.profileEmail}>student@ucp.edu.pk</Text>
          </View>
        </View>

        {/* Settings Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="moon-outline" size={22} color={theme.text} />
              <Text style={styles.menuItemText}>Theme</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemSubtext}>System Default</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.subtext}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={theme.text}
              />
              <Text style={styles.menuItemText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color={theme.text}
              />
              <Text style={styles.menuItemText}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </TouchableOpacity>

          {/* THE LOGOUT BUTTON */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={theme.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 100,
    },
    header: { marginBottom: 30 },
    headerTitle: {
      fontSize: 32,
      fontWeight: "bold",
      color: theme.text,
      letterSpacing: -1,
    },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 40,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.text,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    avatarText: { color: theme.background, fontSize: 24, fontWeight: "bold" },
    profileInfo: { flex: 1 },
    profileName: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    profileEmail: { fontSize: 14, color: theme.subtext },
    section: { marginBottom: 30 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "bold",
      color: theme.subtext,
      letterSpacing: 1.5,
      marginBottom: 15,
      marginLeft: 10,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    menuItemText: { fontSize: 16, fontWeight: "600", color: theme.text },
    menuItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    menuItemSubtext: { fontSize: 14, color: theme.subtext },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      padding: 16,
      borderRadius: 16,
      marginTop: 10,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.2)",
    },
    logoutText: { fontSize: 16, fontWeight: "bold", color: theme.danger },
  });
