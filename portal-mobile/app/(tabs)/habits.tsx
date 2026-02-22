import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
    border: "#E5E5E5",
    card: "#FAFAFA",
    invertedBg: "#000000",
    invertedText: "#FFFFFF",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
  },
};

// --- NATIVE LIVE TIMER FOR BAD HABITS ---
const LiveTimer = ({ startDate }: { startDate: string }) => {
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date().getTime() - new Date(startDate).getTime();
      setTime({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / 1000 / 60) % 60),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      <View
        style={{
          backgroundColor: "rgba(244, 63, 94, 0.1)",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#F43F5E" }}>
          {time.days}
        </Text>
        <Text
          style={{
            fontSize: 9,
            fontWeight: "800",
            color: "#F43F5E",
            textTransform: "uppercase",
          }}
        >
          Days
        </Text>
      </View>
      <View
        style={{
          backgroundColor: "rgba(244, 63, 94, 0.1)",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#F43F5E" }}>
          {String(time.hours).padStart(2, "0")}
        </Text>
        <Text
          style={{
            fontSize: 9,
            fontWeight: "800",
            color: "#F43F5E",
            textTransform: "uppercase",
          }}
        >
          Hrs
        </Text>
      </View>
      <View
        style={{
          backgroundColor: "rgba(244, 63, 94, 0.1)",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#F43F5E" }}>
          {String(time.mins).padStart(2, "0")}
        </Text>
        <Text
          style={{
            fontSize: 9,
            fontWeight: "800",
            color: "#F43F5E",
            textTransform: "uppercase",
          }}
        >
          Min
        </Text>
      </View>
    </View>
  );
};

export default function HabitsScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [activeTab, setActiveTab] = useState<"good" | "bad">("good");
  const [habits, setHabits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHabits = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) return;

      const res = await axios.get(`${BACKEND_URL}/habits`, {
        headers: { "x-auth-token": token },
      });
      setHabits(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Fetch Habits Error:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const executeAction = async (action: string, id: string) => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");

      // Optimistic visual update could be added here, but API reload is safer for habits
      await axios.put(
        `${BACKEND_URL}/habits/${id}/${action}`,
        {},
        { headers: { "x-auth-token": token } },
      );
      fetchHabits();
    } catch (error) {
      Alert.alert("Error", `Failed to ${action} habit.`);
    }
  };

  const goodHabits = habits.filter((h) => h.type === "good");
  const badHabits = habits.filter((h) => h.type === "bad");
  const displayedHabits = activeTab === "good" ? goodHabits : badHabits;

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Habits</Text>
        <Text style={styles.headerSubtitle}>
          Forge discipline & break patterns
        </Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "good" && styles.activeTab]}
          onPress={() => setActiveTab("good")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "good" && styles.activeTabText,
            ]}
          >
            Forge (Good)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "bad" && styles.activeTab]}
          onPress={() => setActiveTab("bad")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "bad" && styles.activeTabText,
            ]}
          >
            Break (Bad)
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchHabits();
              }}
              tintColor={theme.text}
            />
          }
        >
          {displayedHabits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === "good" ? "flame-outline" : "skull-outline"}
                size={64}
                color={theme.border}
              />
              <Text style={styles.emptyText}>No {activeTab} habits found.</Text>
            </View>
          ) : (
            displayedHabits.map((habit) => {
              const isGood = habit.type === "good";

              // Good Habit Logic
              const today = new Date().setHours(0, 0, 0, 0);
              const isCheckedInToday = (habit.checkIns || []).some(
                (d: string) => new Date(d).setHours(0, 0, 0, 0) === today,
              );

              // Bad Habit Logic
              const isModeration = habit.strategy === "moderation";
              const allowancesLeft = Math.max(
                0,
                (habit.allowancePerWeek || 0) - (habit.cheatDays?.length || 0),
              );

              return (
                <View
                  key={habit._id}
                  style={[
                    styles.habitCard,
                    isGood ? styles.goodCard : styles.badCard,
                  ]}
                >
                  <View style={styles.habitHeader}>
                    <View style={styles.titleWrapper}>
                      <Ionicons
                        name={isGood ? "flame" : "skull"}
                        size={20}
                        color={isGood ? "#10B981" : "#F43F5E"}
                      />
                      <Text style={styles.habitName} numberOfLines={2}>
                        {habit.name}
                      </Text>
                    </View>
                  </View>

                  {isGood ? (
                    <View style={styles.metaRow}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaLabel}>STREAK</Text>
                        <Text style={styles.metaValue}>
                          {habit.checkIns?.length || 0}
                        </Text>
                      </View>
                      <TouchableOpacity
                        disabled={isCheckedInToday}
                        onPress={() => executeAction("checkin", habit._id)}
                        style={[
                          styles.actionBtn,
                          isCheckedInToday
                            ? styles.btnDisabled
                            : styles.btnGood,
                        ]}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={isCheckedInToday ? theme.subtext : "#FFF"}
                        />
                        <Text
                          style={[
                            styles.btnText,
                            isCheckedInToday
                              ? { color: theme.subtext }
                              : { color: "#FFF" },
                          ]}
                        >
                          {isCheckedInToday ? "Done Today" : "Check In"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.timerLabel}>CLEAN SINCE</Text>
                      <LiveTimer startDate={habit.startDate} />

                      <View style={styles.badActions}>
                        {isModeration && (
                          <TouchableOpacity
                            disabled={allowancesLeft <= 0}
                            onPress={() => executeAction("cheat", habit._id)}
                            style={[
                              styles.actionBtn,
                              styles.btnWarn,
                              allowancesLeft <= 0 && styles.btnDisabled,
                            ]}
                          >
                            <Text
                              style={[
                                styles.btnText,
                                allowancesLeft <= 0
                                  ? { color: theme.subtext }
                                  : { color: "#FFF" },
                              ]}
                            >
                              Use Allowance ({allowancesLeft})
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => executeAction("reset", habit._id)}
                          style={[styles.actionBtn, styles.btnDanger]}
                        >
                          <Ionicons name="refresh" size={16} color="#FFF" />
                          <Text style={[styles.btnText, { color: "#FFF" }]}>
                            Relapse
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
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
    headerSubtitle: {
      fontSize: 16,
      color: theme.subtext,
      fontWeight: "500",
      marginTop: 4,
    },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: theme.card,
      marginHorizontal: 24,
      borderRadius: 16,
      padding: 6,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: 12,
    },
    activeTab: {
      backgroundColor: theme.invertedBg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    tabText: { fontSize: 14, fontWeight: "700", color: theme.subtext },
    activeTabText: { color: theme.invertedText },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 100, gap: 16 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      opacity: 0.8,
    },
    emptyText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 20,
      letterSpacing: -0.5,
    },

    habitCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    goodCard: { borderLeftWidth: 4, borderLeftColor: "#10B981" },
    badCard: { borderLeftWidth: 4, borderLeftColor: "#F43F5E" },

    habitHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    titleWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    habitName: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      flexShrink: 1,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    metaPill: { alignItems: "flex-start" },
    metaLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
    },
    metaValue: { fontSize: 24, fontWeight: "900", color: theme.text },

    timerLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
      marginTop: 4,
    },

    badActions: { flexDirection: "row", gap: 10, marginTop: 16 },

    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
      flex: 1,
    },
    btnGood: { backgroundColor: "#10B981" },
    btnWarn: { backgroundColor: "#F59E0B" },
    btnDanger: { backgroundColor: "#EF4444" },
    btnDisabled: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  });
