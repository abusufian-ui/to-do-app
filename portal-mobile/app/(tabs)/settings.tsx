import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Appearance,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// --- Pure Monochrome Theme ---
const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
    border: "#E5E5E5",
    card: "#FAFAFA",
    invertedBg: "#000000",
    invertedText: "#FFFFFF",
    danger: "#FF3B30",
    dangerBg: "#FFEBEB",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
    danger: "#FF453A",
    dangerBg: "#3A0A0A",
  },
};

export default function SettingsScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  // Added isAdmin to the state type
  const [userData, setUserData] = useState<{
    name: string;
    email: string;
    initials: string;
    isAdmin: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeThemeMode, setActiveThemeMode] = useState<
    "light" | "dark" | "system"
  >("system");

  // --- FETCH REAL USER DATA FROM MONGODB ---
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
        const token = await AsyncStorage.getItem("userToken");

        if (!token || !BACKEND_URL) return;

        const res = await axios.get(`${BACKEND_URL}/auth/user`, {
          headers: { "x-auth-token": token },
        });

        const name = res.data.name || "Unknown User";
        const email = res.data.email || "No email linked";

        // Check if the user is the Super Admin
        const isAdmin =
          res.data.isAdmin || email.toLowerCase() === "ranasuffyan9@gmail.com";

        // Create initials (e.g., "Abu Sufian" -> "AS")
        const initials =
          name
            .match(/(\b\S)?/g)
            ?.join("")
            .match(/(^\S|\S$)?/g)
            ?.join("")
            .toUpperCase() || "U";

        setUserData({ name, email, initials, isAdmin });
      } catch (error) {
        console.error("Failed to load user profile", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();

    // Load saved theme preference
    AsyncStorage.getItem("themePref").then((savedTheme) => {
      if (
        savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "system"
      ) {
        setActiveThemeMode(savedTheme);
      }
    });
  }, []);

  // --- THEME SWITCHER LOGIC ---
  const handleThemeChange = async (mode: "light" | "dark" | "system") => {
    setActiveThemeMode(mode);
    await AsyncStorage.setItem("themePref", mode);

    // The Appearance API physically overrides the device's theme setting inside the app
    if (mode === "system") {
      Appearance.setColorScheme(null); // Resets to follow iOS/Android system settings
    } else {
      Appearance.setColorScheme(mode); // Forces pure light or pure dark mode
    }
  };

  // --- LOGOUT LOGIC ---
  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of your portal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("userToken");
            router.replace("/");
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* --- PROFILE CARD --- */}
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{userData?.initials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userData?.name}</Text>
              <Text style={styles.profileEmail}>{userData?.email}</Text>
            </View>

            {/* DYNAMIC ROLE BADGE */}
            <View
              style={[styles.proBadge, userData?.isAdmin && styles.adminBadge]}
            >
              <Text
                style={[
                  styles.proBadgeText,
                  userData?.isAdmin && styles.adminBadgeText,
                ]}
              >
                {userData?.isAdmin ? "ADMIN" : "STUDENT"}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>PREFERENCES</Text>

          {/* --- THEME SELECTOR BENTO --- */}
          <View style={styles.settingBlock}>
            <View style={styles.settingHeader}>
              <Ionicons
                name="color-palette-outline"
                size={20}
                color={theme.text}
              />
              <Text style={styles.settingTitle}>App Theme</Text>
            </View>

            <View style={styles.themeSelector}>
              {(["system", "light", "dark"] as const).map((mode) => {
                const isActive = activeThemeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    activeOpacity={0.8}
                    onPress={() => handleThemeChange(mode)}
                    style={[styles.themeBtn, isActive && styles.activeThemeBtn]}
                  >
                    <Ionicons
                      name={
                        mode === "system"
                          ? "phone-portrait-outline"
                          : mode === "light"
                            ? "sunny-outline"
                            : "moon-outline"
                      }
                      size={16}
                      color={isActive ? theme.invertedText : theme.subtext}
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        isActive && styles.activeThemeBtnText,
                      ]}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Additional Settings Placeholder */}
          <View style={styles.settingBlock}>
            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={theme.text}
                />
                <Text style={styles.settingTitle}>Push Notifications</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.subtext}
              />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={theme.text}
                />
                <Text style={styles.settingTitle}>Security & PIN</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.subtext}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeading}>ACCOUNT</Text>

          {/* --- LOG OUT BUTTON --- */}
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* App Version Stamp */}
          <Text style={styles.versionText}>MyPortal v2.0.0 (Beta)</Text>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 24, marginBottom: 20 },
    headerTitle: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -1,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },

    // Profile Card
    profileCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 35,
    },
    avatarCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.invertedBg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    avatarText: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.invertedText,
      letterSpacing: 1,
    },
    profileInfo: { flex: 1 },
    profileName: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    profileEmail: { fontSize: 13, color: theme.subtext, fontWeight: "500" },

    // Badges
    proBadge: {
      backgroundColor: theme.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    proBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: 1,
    },
    adminBadge: {
      backgroundColor: theme.invertedBg,
      borderColor: theme.invertedBg,
    },
    adminBadgeText: { color: theme.invertedText },

    sectionHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1.5,
      marginBottom: 12,
      marginLeft: 5,
    },

    // Setting Blocks
    settingBlock: {
      backgroundColor: theme.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 25,
      padding: 6,
    },
    settingHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      paddingBottom: 10,
    },
    settingTitle: { fontSize: 16, fontWeight: "700", color: theme.text },

    // Theme Selector (Segmented Pill)
    themeSelector: {
      flexDirection: "row",
      backgroundColor: theme.background,
      borderRadius: 14,
      padding: 4,
      marginHorizontal: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    themeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    activeThemeBtn: {
      backgroundColor: theme.invertedBg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    themeBtnText: { fontSize: 13, fontWeight: "700", color: theme.subtext },
    activeThemeBtnText: { color: theme.invertedText },

    // List Rows
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 14,
    },
    settingRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    divider: { height: 1, backgroundColor: theme.border, marginHorizontal: 14 },

    // Logout Button
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.dangerBg,
      paddingVertical: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255, 59, 48, 0.2)",
      marginBottom: 40,
    },
    logoutText: { fontSize: 16, fontWeight: "800", color: theme.danger },

    versionText: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: theme.subtext,
      opacity: 0.5,
    },
  });
