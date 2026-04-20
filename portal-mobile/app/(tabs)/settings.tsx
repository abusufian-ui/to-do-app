import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Appearance,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  LogBox,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 🚨 IMPORTED OUR NEW BACKGROUND ENGINE LOGIC
import * as BackgroundFetch from "expo-background-fetch";
import { forceRunScraper } from "../../services/syncService";

import PortalSync from "../../components/PortalSync";
import UCPLogo from "../../components/UCPLogo";

LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

  // 🚨 GET PARAMS FROM NOTIFICATION ROUTING
  const { autoLaunch } = useLocalSearchParams();
  const hasAutoPrompted = useRef(false);

  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight || 0 : insets.top;

  const [userData, setUserData] = useState<{
    name: string;
    email: string;
    initials: string;
    isAdmin: boolean;
    isPortalConnected: boolean;
    lastSyncAt: string | null;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false); // 🚨 ADDED FOR NEW BUTTON LOGIC

  // --- PORTAL SYNC STATE ---
  const [showPortal, setShowPortal] = useState(false);
  const [jwtToken, setJwtToken] = useState<string | null>(null);

  // --- PREFERENCES & COURSES STATE ---
  const [activeThemeMode, setActiveThemeMode] = useState<
    "light" | "dark" | "system"
  >("system");

  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  const [uniCourses, setUniCourses] = useState<any[]>([]);
  const [hiddenCourses, setHiddenCourses] = useState<string[]>([]);
  const [showVisibilityAccordion, setShowVisibilityAccordion] = useState(false);

  // --- FEEDBACK / DISPUTE STATE ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackDesc, setFeedbackDesc] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const fetchUserAndCourses = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      setJwtToken(token);

      const cachedData = await AsyncStorage.getItem("cachedProfileData");
      if (cachedData) setUserData(JSON.parse(cachedData));

      const savedHidden = await AsyncStorage.getItem("hiddenCourses");
      if (savedHidden) setHiddenCourses(JSON.parse(savedHidden));

      if (!token || !BACKEND_URL) return;

      const [userRes, coursesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/auth/user`, {
          headers: { "x-auth-token": token },
        }),
        axios
          .get(`${BACKEND_URL}/courses`, { headers: { "x-auth-token": token } })
          .catch(() => null),
      ]);

      if (coursesRes && coursesRes.data) {
        const uCourses = coursesRes.data.filter(
          (c: any) => c.type === "university" || c.type === "uni",
        );
        setUniCourses(uCourses);
      }

      const name = userRes.data.name || "Unknown User";
      const email = userRes.data.email || "No email linked";
      const isAdmin =
        userRes.data.isAdmin ||
        email.toLowerCase() === "ranasuffyan9@gmail.com";
      const isConnected = userRes.data.isPortalConnected || false;
      const lastSync = userRes.data.lastSyncAt || null;
      const initials =
        name
          .match(/(\b\S)?/g)
          ?.join("")
          .match(/(^\S|\S$)?/g)
          ?.join("")
          .toUpperCase() || "U";

      const freshData = {
        name,
        email,
        initials,
        isAdmin,
        isPortalConnected: isConnected,
        lastSyncAt: lastSync,
      };
      setUserData(freshData);
      setIsOffline(false);
      await AsyncStorage.setItem(
        "cachedProfileData",
        JSON.stringify(freshData),
      );

      // 🚨 AUTO-LAUNCH LOGIC FOR DEAD COOKIES OR NOTIFICATION TAPS
      if ((!isConnected || autoLaunch === "true") && !hasAutoPrompted.current) {
        hasAutoPrompted.current = true;
        setShowPortal(true);
      }
    } catch (error: any) {
      if (!error.response) setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAndSyncNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const enabled = status === "granted";
      setIsNotifEnabled(enabled);

      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

      if (enabled && token && BACKEND_URL) {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ||
          "46cb0ede-207a-4611-acdc-5fc2954ddcf2";

        const pushTokenString = (
          await Notifications.getExpoPushTokenAsync({ projectId })
        ).data;

        await axios
          .post(
            `${BACKEND_URL}/user/push-token`,
            { token: pushTokenString },
            { headers: { "x-auth-token": token } },
          )
          .catch(() => {});
      } else if (!enabled && token && BACKEND_URL) {
        await axios
          .post(
            `${BACKEND_URL}/user/push-token`,
            { token: null },
            { headers: { "x-auth-token": token } },
          )
          .catch(() => {});
      }
    } catch (e) {
      console.log("🚨 Error during push token generation/sync:", e);
    }
  };

  useEffect(() => {
    fetchUserAndCourses();
    checkAndSyncNotificationStatus();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        checkAndSyncNotificationStatus();
      }
    });

    AsyncStorage.getItem("themePref").then((savedTheme) => {
      if (
        savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "system"
      )
        setActiveThemeMode(savedTheme);
    });

    return () => {
      subscription.remove();
    };
  }, [autoLaunch]);

  const handleThemeChange = async (mode: "light" | "dark" | "system") => {
    setActiveThemeMode(mode);
    await AsyncStorage.setItem("themePref", mode);
    if (mode === "system") Appearance.setColorScheme(null);
    else Appearance.setColorScheme(mode);
  };

  const toggleCourseVisibility = async (courseName: string) => {
    let updated = [...hiddenCourses];
    if (updated.includes(courseName)) {
      updated = updated.filter((name) => name !== courseName);
    } else {
      updated.push(courseName);
    }
    setHiddenCourses(updated);
    await AsyncStorage.setItem("hiddenCourses", JSON.stringify(updated));
  };

  const submitFeedback = async () => {
    if (!feedbackSubject.trim() || !feedbackDesc.trim()) {
      Alert.alert(
        "Missing Fields",
        "Please provide both a subject and a description.",
      );
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      await axios.post(
        `${BACKEND_URL}/feedback`,
        { subject: feedbackSubject, description: feedbackDesc },
        { headers: { "x-auth-token": jwtToken } },
      );

      Alert.alert(
        "Feedback Submitted",
        "Your request has been sent successfully. We will look into it!",
      );
      setShowFeedbackModal(false);
      setFeedbackSubject("");
      setFeedbackDesc("");
    } catch (error: any) {
      Alert.alert(
        "Submission Failed",
        error.response?.data?.message || "Check your network connection.",
      );
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

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
            await AsyncStorage.removeItem("cachedProfileData");
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter((k) => k.startsWith("off_"));
            await AsyncStorage.multiRemove(cacheKeys);
            await Notifications.cancelAllScheduledNotificationsAsync();
            if (router.canDismiss()) router.dismissAll();
            router.replace("/login");
          },
        },
      ],
    );
  };

  const handleSyncComplete = () => {
    setShowPortal(false);
    fetchUserAndCourses();
  };

  return (
    <View style={styles.container}>
      {/* PORTAL SYNC MODAL */}
      <Modal
        visible={showPortal}
        animationType="slide"
        presentationStyle="pageSheet"
        statusBarTranslucent={true}
        hardwareAccelerated={true}
        onRequestClose={() => setShowPortal(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View
            style={[
              styles.modalHeader,
              { paddingTop: Platform.OS === "ios" ? 15 : statusBarHeight + 10 },
            ]}
          >
            <View style={{ width: 60 }} />
            <View style={styles.modalTitleContainer}>
              <Ionicons name="logo-microsoft" size={18} color="#00a4ef" />
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Login with Microsoft
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowPortal(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          {jwtToken && (
            <PortalSync
              jwtToken={jwtToken}
              onSyncComplete={handleSyncComplete}
            />
          )}
        </View>
      </Modal>

      {/* FEEDBACK & DISPUTE MODAL */}
      <Modal
        visible={showFeedbackModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.feedbackOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.feedbackCard}>
              <View style={styles.feedbackHeader}>
                <Text style={styles.feedbackTitle}>Report an Issue</Text>
                <TouchableOpacity
                  onPress={() => setShowFeedbackModal(false)}
                  style={styles.feedbackCloseIcon}
                >
                  <Ionicons name="close" size={24} color={theme.subtext} />
                </TouchableOpacity>
              </View>

              <Text style={styles.feedbackSubText}>
                Help us improve your experience. Describe the bug, feature
                request, or dispute below.
              </Text>

              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Syncing Issue, Feature Request..."
                placeholderTextColor={theme.subtext}
                value={feedbackSubject}
                onChangeText={setFeedbackSubject}
                maxLength={50}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Please describe the issue in detail..."
                placeholderTextColor={theme.subtext}
                value={feedbackDesc}
                onChangeText={setFeedbackDesc}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.submitFeedbackBtn,
                  isSubmittingFeedback && { opacity: 0.7 },
                ]}
                activeOpacity={0.8}
                onPress={submitFeedback}
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback ? (
                  <ActivityIndicator color={theme.invertedText} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="paper-plane"
                      size={18}
                      color={theme.invertedText}
                    />
                    <Text style={styles.submitFeedbackText}>Send Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {isLoading && !userData ? (
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
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.settingHeader, { paddingBottom: 16 }]}
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut,
                );
                setShowVisibilityAccordion(!showVisibilityAccordion);
              }}
            >
              <Ionicons name="eye-outline" size={20} color={theme.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Course Visibility</Text>
                <Text style={styles.settingRowSub}>
                  Hide or unhide subjects from UI
                </Text>
              </View>
              <Ionicons
                name={showVisibilityAccordion ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.subtext}
              />
            </TouchableOpacity>

            {showVisibilityAccordion && (
              <View style={styles.accordionBody}>
                {uniCourses.length === 0 ? (
                  <Text style={styles.emptyAccordionText}>
                    No synced courses available to manage.
                  </Text>
                ) : (
                  uniCourses.map((course, idx) => {
                    const isVisible = !hiddenCourses.includes(course.name);
                    return (
                      <View key={idx} style={styles.courseVisRow}>
                        <View style={styles.courseVisLeft}>
                          <UCPLogo width={22} height={22} color={theme.text} />
                          <Text
                            style={[
                              styles.courseVisName,
                              { color: theme.text },
                            ]}
                            numberOfLines={2}
                          >
                            {course.name}
                          </Text>
                        </View>
                        <Switch
                          value={isVisible}
                          onValueChange={() =>
                            toggleCourseVisibility(course.name)
                          }
                          trackColor={{
                            false: theme.border,
                            true: theme.success,
                          }}
                          ios_backgroundColor={theme.border}
                        />
                      </View>
                    );
                  })
                )}
              </View>
            )}
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

            <View style={styles.syncStatusContainer}>
              <View style={styles.statusDotRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isNotifEnabled
                        ? theme.success
                        : theme.danger,
                    },
                  ]}
                />
                <Text style={[styles.statusText, { color: theme.text }]}>
                  {isNotifEnabled ? "Enabled" : "Disabled"}
                </Text>
              </View>
              <Text
                style={[styles.lastSyncText, { marginLeft: 0, marginTop: 4 }]}
              >
                {isNotifEnabled
                  ? "You are receiving tasks, prayers, and class alerts."
                  : "Tap below to manage alerts in your device settings."}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.connectPortalBtn}
              activeOpacity={0.8}
              onPress={Linking.openSettings}
            >
              <Text
                style={[styles.connectPortalTitle, { color: theme.background }]}
              >
                {isNotifEnabled ? "Manage Settings" : "Enable Notifications"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeading}>SUPPORT</Text>

          <View style={styles.settingBlock}>
            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => setShowFeedbackModal(true)}
            >
              <View style={styles.settingRowLeft}>
                <View
                  style={[
                    styles.iconBg,
                    { backgroundColor: "rgba(245, 158, 11, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={18}
                    color="#F59E0B"
                  />
                </View>
                <View>
                  <Text style={styles.settingRowTitle}>Report an Issue</Text>
                  <Text style={styles.settingRowSub}>
                    Feedback, bugs, or feature requests
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.subtext}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeading}>ACCOUNT</Text>

          <View style={styles.settingBlock}>
            <View style={styles.settingHeader}>
              <Ionicons
                name={isOffline ? "cloud-offline-outline" : "link-outline"}
                size={20}
                color={theme.text}
              />
              <Text style={styles.settingTitle}>UCP Portal Sync</Text>
            </View>

            <View style={styles.syncStatusContainer}>
              <View style={styles.statusDotRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isOffline
                        ? theme.subtext
                        : userData?.isPortalConnected
                          ? theme.success
                          : theme.danger,
                    },
                  ]}
                />
                <Text style={[styles.statusText, { color: theme.text }]}>
                  {isOffline
                    ? "Network Unavailable"
                    : userData?.isPortalConnected
                      ? "Live Auto-Sync Active"
                      : "Not Connected"}
                </Text>
              </View>

              {userData?.isPortalConnected ? (
                <Text
                  style={[
                    styles.lastSyncText,
                    { color: theme.success, opacity: 0.8 },
                  ]}
                >
                  Running autonomously in background
                </Text>
              ) : (
                userData?.lastSyncAt && (
                  <Text style={[styles.lastSyncText, { color: theme.danger }]}>
                    Stopped:{" "}
                    {new Date(userData.lastSyncAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )
              )}
            </View>

            {/* 🚨 THIS IS THE UPDATED SMART BUTTON 🚨 */}
            <TouchableOpacity
              style={[
                styles.connectPortalBtn,
                (isOffline || isManualSyncing) && { opacity: 0.5 },
              ]}
              activeOpacity={0.8}
              disabled={isOffline || isManualSyncing}
              onPress={async () => {
                if (!jwtToken) {
                  Alert.alert("Error", "Please log in to MyPortal first.");
                  return;
                }

                if (userData?.isPortalConnected) {
                  // 🚀 SCENARIO A: Trigger the Headless Background Scraper
                  setIsManualSyncing(true);
                  try {
                    const result = await forceRunScraper();

                    if (
                      result === BackgroundFetch.BackgroundFetchResult.Failed ||
                      result === BackgroundFetch.BackgroundFetchResult.NoData
                    ) {
                      // The cookie is dead or missing! Fallback to WebView to re-authenticate.
                      Alert.alert(
                        "Session Expired",
                        "We need to re-authenticate your Microsoft session.",
                      );
                      setShowPortal(true);
                    } else {
                      // Success!
                      Alert.alert(
                        "Sync Complete",
                        "Your portal data is fresh and up to date!",
                      );
                      fetchUserAndCourses(); // Refresh UI
                    }
                  } catch (e) {
                    Alert.alert("Error", "Manual sync failed.");
                  } finally {
                    setIsManualSyncing(false);
                  }
                } else {
                  // 🚀 SCENARIO B: First time connecting, open WebView
                  setShowPortal(true);
                }
              }}
            >
              {isManualSyncing ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <Text
                  style={[
                    styles.connectPortalTitle,
                    { color: theme.background },
                  ]}
                >
                  {userData?.isPortalConnected
                    ? "Force Sync Now"
                    : "Connect UCP Account"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

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

    accordionBody: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 10,
    },
    courseVisRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    courseVisLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 12,
      paddingRight: 16,
    },
    courseVisName: {
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: -0.2,
      flex: 1,
    },
    emptyAccordionText: {
      color: theme.subtext,
      fontSize: 13,
      fontStyle: "italic",
      textAlign: "center",
      paddingVertical: 10,
    },

    syncStatusContainer: { paddingHorizontal: 16, paddingBottom: 16 },
    statusDotRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: { fontSize: 15, fontWeight: "600" },
    lastSyncText: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: "500",
      marginLeft: 18,
    },
    connectPortalBtn: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.text,
      paddingVertical: 14,
      borderRadius: 16,
      marginHorizontal: 10,
      marginBottom: 10,
    },
    connectPortalTitle: { fontSize: 15, fontWeight: "700" },

    // --- PORTAL MODAL UI ---
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    modalTitleContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
    modalTitle: { fontSize: 16, fontWeight: "700" },
    modalCloseBtn: { width: 60, alignItems: "flex-end" },
    modalCloseText: { fontSize: 16, fontWeight: "600", color: theme.brand },

    // --- FEEDBACK MODAL UI ---
    feedbackOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    feedbackCard: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: 40,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 20,
    },
    feedbackHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    feedbackTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -0.5,
    },
    feedbackCloseIcon: {
      padding: 4,
      backgroundColor: theme.card,
      borderRadius: 16,
    },
    feedbackSubText: {
      fontSize: 14,
      color: theme.subtext,
      lineHeight: 20,
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    textInput: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
      marginBottom: 20,
    },
    textArea: {
      height: 120,
      paddingTop: 16,
    },
    submitFeedbackBtn: {
      backgroundColor: theme.invertedBg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
      borderRadius: 16,
      marginTop: 10,
    },
    submitFeedbackText: {
      color: theme.invertedText,
      fontSize: 16,
      fontWeight: "800",
    },

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
