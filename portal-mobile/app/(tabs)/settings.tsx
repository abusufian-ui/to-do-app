import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Appearance,
  LogBox,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// --- THE FIX: MUTE EXPO GO SDK 53 WARNING ---
LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);

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
    success: "#10B981",
    brand: "#3B82F6",
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
    success: "#10B981",
    brand: "#3B82F6",
  },
};

export default function SettingsScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [userData, setUserData] = useState<{
    name: string;
    email: string;
    initials: string;
    isAdmin: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Preferences State
  const [activeThemeMode, setActiveThemeMode] = useState<
    "light" | "dark" | "system"
  >("system");
  const [generalNotifs, setGeneralNotifs] = useState(false);
  const [prayerNotifs, setPrayerNotifs] = useState(false);

  // --- FETCH REAL USER DATA & PREFERENCES ---
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
        const isAdmin =
          res.data.isAdmin || email.toLowerCase() === "ranasuffyan9@gmail.com";
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

    // Load saved preferences
    AsyncStorage.multiGet(["themePref", "generalNotifs", "prayerNotifs"]).then(
      (values) => {
        const savedTheme = values[0][1];
        const savedGeneral = values[1][1];
        const savedPrayer = values[2][1];

        if (
          savedTheme === "light" ||
          savedTheme === "dark" ||
          savedTheme === "system"
        )
          setActiveThemeMode(savedTheme);
        if (savedGeneral === "true") setGeneralNotifs(true);
        if (savedPrayer === "true") setPrayerNotifs(true);
      },
    );
  }, []);

  // --- THEME SWITCHER LOGIC ---
  const handleThemeChange = async (mode: "light" | "dark" | "system") => {
    setActiveThemeMode(mode);
    await AsyncStorage.setItem("themePref", mode);
    if (mode === "system") {
      Appearance.setColorScheme(null);
    } else {
      Appearance.setColorScheme(mode);
    }
  };

  // --- NOTIFICATION PERMISSION HANDLER ---
  const requestNotificationPermission = async () => {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable notifications in your phone settings.",
        );
        return false;
      }
      return true;
    } catch (e) {
      Alert.alert(
        "Simulator Notice",
        "Push Notifications require a built APK/App to test fully.",
      );
      return false;
    }
  };

  // --- UPDATED SERVER SYNC LOGIC ---
  const toggleGeneralNotifs = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setGeneralNotifs(false);
        return;
      }

      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId || "YOUR_PROJECT_ID_HERE";
        const pushTokenString = (
          await Notifications.getExpoPushTokenAsync({ projectId })
        ).data;

        const token = await AsyncStorage.getItem("userToken");
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

        if (token && BACKEND_URL) {
          await axios.post(
            `${BACKEND_URL}/user/push-token`,
            { token: pushTokenString },
            { headers: { "x-auth-token": token } },
          );
        }

        Alert.alert(
          "General Alerts Enabled",
          "You will now be notified 15 mins before tasks via the server.",
        );
      } catch (e) {
        console.error("Failed to register token", e);
        Alert.alert("Error", "Could not connect to notification server.");
        setGeneralNotifs(false);
        return;
      }
    } else {
      try {
        const token = await AsyncStorage.getItem("userToken");
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
        if (token && BACKEND_URL) {
          await axios.post(
            `${BACKEND_URL}/user/push-token`,
            { token: null },
            { headers: { "x-auth-token": token } },
          );
        }
      } catch (e) {
        console.error("Failed to remove token", e);
      }
      await Notifications.cancelAllScheduledNotificationsAsync();
      Alert.alert("Alerts Muted", "Server alerts have been disabled.");
    }
    setGeneralNotifs(value);
    await AsyncStorage.setItem("generalNotifs", value ? "true" : "false");
  };

  const togglePrayerNotifs = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setPrayerNotifs(false);
        return;
      }
      Alert.alert(
        "Prayer Alerts Enabled",
        "You will now receive server-synced reminders for all 5 daily prayers.",
      );
    }

    // Tell the backend about the preference change
    try {
      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (token && BACKEND_URL) {
        await axios.put(
          `${BACKEND_URL}/user/preferences`,
          { prayerNotifs: value },
          { headers: { "x-auth-token": token } },
        );
      }
    } catch (e) {
      console.error("Failed to sync prayer preference", e);
    }

    setPrayerNotifs(value);
    await AsyncStorage.setItem("prayerNotifs", value ? "true" : "false");
  };

  // --- BULLETPROOF LOGOUT ---
  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to securely sign out of your portal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("userToken");

            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter((k) => k.startsWith("off_"));
            await AsyncStorage.multiRemove(cacheKeys);

            await Notifications.cancelAllScheduledNotificationsAsync();

            if (router.canDismiss()) {
              router.dismissAll();
            }

            router.replace("/login");
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{userData?.initials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userData?.name}</Text>
              <Text style={styles.profileEmail}>{userData?.email}</Text>
            </View>
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

          <View style={styles.settingBlock}>
            <View style={styles.settingHeader}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={theme.text}
              />
              <Text style={styles.settingTitle}>Push Notifications</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <View
                  style={[
                    styles.iconBg,
                    { backgroundColor: "rgba(59, 130, 246, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={theme.brand}
                  />
                </View>
                <View>
                  <Text style={styles.settingRowTitle}>General Alerts</Text>
                  <Text style={styles.settingRowSub}>
                    Classes (5m) & Tasks (15m)
                  </Text>
                </View>
              </View>
              <Switch
                value={generalNotifs}
                onValueChange={toggleGeneralNotifs}
                trackColor={{ false: theme.border, true: theme.brand }}
                ios_backgroundColor={theme.border}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <View
                  style={[
                    styles.iconBg,
                    { backgroundColor: "rgba(16, 185, 129, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="moon-outline"
                    size={18}
                    color={theme.success}
                  />
                </View>
                <View>
                  <Text style={styles.settingRowTitle}>Prayer Alerts</Text>
                  <Text style={styles.settingRowSub}>
                    5 Daily Namaz Reminders
                  </Text>
                </View>
              </View>
              <Switch
                value={prayerNotifs}
                onValueChange={togglePrayerNotifs}
                trackColor={{ false: theme.border, true: theme.success }}
                ios_backgroundColor={theme.border}
              />
            </View>
          </View>

          <Text style={styles.sectionHeading}>ACCOUNT</Text>

          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>MyPortal v2.0.0 (Beta)</Text>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, paddingTop: 10 },
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

    settingBlock: {
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 25,
      padding: 6,
    },
    settingHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 16,
      paddingBottom: 10,
    },
    settingTitle: { fontSize: 16, fontWeight: "800", color: theme.text },

    themeSelector: {
      flexDirection: "row",
      backgroundColor: theme.background,
      borderRadius: 14,
      padding: 4,
      marginHorizontal: 10,
      marginBottom: 10,
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

    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    settingRowLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
    iconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    settingRowTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 2,
    },
    settingRowSub: { fontSize: 12, color: theme.subtext, fontWeight: "500" },
    divider: { height: 1, backgroundColor: theme.border, marginHorizontal: 16 },

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
