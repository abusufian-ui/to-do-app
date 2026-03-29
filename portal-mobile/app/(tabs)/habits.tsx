import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
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
    invertedBg: "#000000",
    brand: "#3B82F6",
    success: "#10B981",
    danger: "#F43F5E",
    warning: "#F59E0B",
    qazah: "#8B5CF6",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    brand: "#60A5FA",
    success: "#34D399",
    danger: "#FB7185",
    warning: "#FBBF24",
    qazah: "#A78BFA",
  },
};

const NAMAZ_PRAYERS = [
  { id: "fajr", name: "Fajr", icon: "partly-sunny", color: "#818CF8" },
  { id: "zuhr", name: "Zuhr", icon: "sunny", color: "#FBBF24" },
  { id: "asr", name: "Asr", icon: "sunny-outline", color: "#F97316" },
  {
    id: "maghrib",
    name: "Maghrib",
    icon: "partly-sunny-outline",
    color: "#FB7185",
  },
  { id: "isha", name: "Isha", icon: "moon", color: "#60A5FA" },
];

const LiveTimer = ({ startDate }: { startDate: string }) => {
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date().getTime() - new Date(startDate).getTime();
      setTime({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / 1000 / 60) % 60),
        secs: Math.floor((diff / 1000) % 60),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      <View style={stylesStatic.timerBox}>
        <Text style={stylesStatic.timerVal}>{time.days}</Text>
        <Text style={stylesStatic.timerLbl}>Days</Text>
      </View>
      <View style={stylesStatic.timerBox}>
        <Text style={stylesStatic.timerVal}>
          {String(time.hours).padStart(2, "0")}
        </Text>
        <Text style={stylesStatic.timerLbl}>Hrs</Text>
      </View>
      <View style={stylesStatic.timerBox}>
        <Text style={stylesStatic.timerVal}>
          {String(time.mins).padStart(2, "0")}
        </Text>
        <Text style={stylesStatic.timerLbl}>Min</Text>
      </View>
      <View style={stylesStatic.timerBox}>
        <Text style={stylesStatic.timerValSec}>
          {String(time.secs).padStart(2, "0")}
        </Text>
        <Text style={stylesStatic.timerLbl}>Sec</Text>
      </View>
    </View>
  );
};

const stylesStatic = StyleSheet.create({
  timerBox: {
    flex: 1,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  timerVal: { fontSize: 18, fontWeight: "900", color: "#F43F5E" },
  timerValSec: { fontSize: 18, fontWeight: "900", color: "#FDA4AF" },
  timerLbl: {
    fontSize: 9,
    fontWeight: "800",
    color: "#F43F5E",
    textTransform: "uppercase",
    marginTop: 2,
  },
});

const isThisWeek = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1),
  );
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
};

const isWithinLast7Days = (dateString: string) => {
  if (!dateString) return false;
  const date = new Date(dateString).getTime();
  const now = new Date().getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return now - date <= sevenDays;
};

const calculateStreak = (checkIns: string[]) => {
  if (!checkIns || checkIns.length === 0) return 0;
  const uniqueDays = [
    ...new Set(checkIns.map((d) => new Date(d).setHours(0, 0, 0, 0))),
  ].sort((a, b) => b - a);
  let streak = 0;
  let currentDate = new Date().setHours(0, 0, 0, 0);
  if (uniqueDays[0] !== currentDate) currentDate -= 86400000;

  for (const day of uniqueDays) {
    if (day === currentDate) {
      streak++;
      currentDate -= 86400000;
    } else if (day < currentDate) break;
  }
  return streak;
};

export default function HabitsScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [activeTab, setActiveTab] = useState<"namaz" | "good" | "bad">("namaz");
  const [habits, setHabits] = useState<any[]>([]);
  const [namazRecord, setNamazRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    action: "",
    habitId: "",
    title: "",
    message: "",
    btnText: "",
    btnColor: "",
  });

  const fetchData = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");

      const cHabits = await AsyncStorage.getItem("off_habits_data");
      const cNamaz = await AsyncStorage.getItem("off_namaz_data");

      if (cHabits) setHabits(JSON.parse(cHabits));
      if (cNamaz) setNamazRecord(JSON.parse(cNamaz));

      if (!BACKEND_URL || !token) return setIsLoading(false);

      const [habitsRes, namazRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/habits`, {
          headers: { "x-auth-token": token },
        }),
        axios.get(`${BACKEND_URL}/namaz/today`, {
          headers: { "x-auth-token": token },
        }),
      ]);

      setHabits(Array.isArray(habitsRes.data) ? habitsRes.data : []);
      setNamazRecord(namazRes.data);

      AsyncStorage.setItem("off_habits_data", JSON.stringify(habitsRes.data));
      AsyncStorage.setItem("off_namaz_data", JSON.stringify(namazRes.data));
    } catch (error) {
      console.log("Offline mode active.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleNamazAction = async (prayerName: string) => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");

      // Optmistic Update
      const oldRecord = { ...namazRecord };
      const tempRecord = { ...namazRecord };
      if (tempRecord.prayers[prayerName] === "pending")
        tempRecord.prayers[prayerName] = "offered";
      else tempRecord.prayers[prayerName] = "qazah";
      setNamazRecord(tempRecord);

      const res = await axios.post(
        `${BACKEND_URL}/namaz/offer`,
        { prayerName },
        { headers: { "x-auth-token": token } },
      );
      setNamazRecord(res.data);
      AsyncStorage.setItem("off_namaz_data", JSON.stringify(res.data));
    } catch (error) {
      Alert.alert("Error", "Could not log prayer.");
      fetchData(); // Rollback
    }
  };

  const executeHabitAction = async (action: string, id: string) => {
    try {
      // 1. Instantly update the UI so it doesn't get stuck waiting
      if (action === "checkin") {
        setHabits((prev) =>
          prev.map((h) =>
            h._id === id
              ? {
                  ...h,
                  checkIns: [...(h.checkIns || []), new Date().toISOString()],
                }
              : h,
          ),
        );
      } else if (action === "cheat") {
        setHabits((prev) =>
          prev.map((h) =>
            h._id === id
              ? {
                  ...h,
                  cheatDays: [...(h.cheatDays || []), new Date().toISOString()],
                }
              : h,
          ),
        );
      } else if (action === "reset") {
        setHabits((prev) =>
          prev.map((h) =>
            h._id === id
              ? { ...h, startDate: new Date().toISOString(), cheatDays: [] }
              : h,
          ),
        );
      }

      // 2. Send to backend silently
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      await axios.put(
        `${BACKEND_URL}/habits/${id}/${action}`,
        {},
        { headers: { "x-auth-token": token } },
      );

      fetchData();
    } catch (error) {
      Alert.alert("Error", `Failed to log progress.`);
    }
  };

  const goodHabits = habits.filter(
    (h) => h.type === "good" && h.name !== "Daily Namaz",
  );
  const badHabits = habits.filter((h) => h.type === "bad");

  return (
    <View style={styles.container}>
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View
              style={[
                styles.modalIconBg,
                { borderColor: confirmModal.btnColor },
              ]}
            >
              <Ionicons
                name="warning"
                size={28}
                color={confirmModal.btnColor || theme.text}
              />
            </View>
            <Text style={styles.modalTitle}>{confirmModal.title}</Text>
            <Text style={styles.modalSub}>{confirmModal.message}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() =>
                  setConfirmModal({ ...confirmModal, visible: false })
                }
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  executeHabitAction(confirmModal.action, confirmModal.habitId);
                  setConfirmModal({ ...confirmModal, visible: false });
                }}
                style={[
                  styles.modalBtnConfirm,
                  { backgroundColor: confirmModal.btnColor },
                ]}
              >
                <Text style={styles.modalBtnTextConfirm}>
                  {confirmModal.btnText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "namaz" && styles.activeTabNamaz]}
          onPress={() => setActiveTab("namaz")}
        >
          <Text
            style={[styles.tabText, activeTab === "namaz" && { color: "#FFF" }]}
          >
            Namaz
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "good" && styles.activeTabGood]}
          onPress={() => setActiveTab("good")}
        >
          <Text
            style={[styles.tabText, activeTab === "good" && { color: "#FFF" }]}
          >
            Pursuits
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "bad" && styles.activeTabBad]}
          onPress={() => setActiveTab("bad")}
        >
          <Text
            style={[styles.tabText, activeTab === "bad" && { color: "#FFF" }]}
          >
            Vices
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
                fetchData();
              }}
              tintColor={theme.text}
            />
          }
        >
          {activeTab === "namaz" &&
            namazRecord &&
            (() => {
              const offeredCount = Object.values(namazRecord.prayers).filter(
                (s) => s === "offered" || s === "qazah",
              ).length;

              return (
                <View style={styles.animateFade}>
                  <View style={styles.namazHero}>
                    <Ionicons
                      name="moon"
                      size={32}
                      color="#10B981"
                      style={{ marginBottom: 10 }}
                    />
                    <Text style={styles.namazTitle}>Daily Namaz Tracker</Text>
                    <Text style={styles.namazSubtitle}>
                      "Indeed, prayer has been decreed upon the believers a
                      decree of specified times."
                    </Text>
                    <View style={styles.namazBadge}>
                      <Text style={styles.namazBadgeText}>
                        {offeredCount} / 5 Completed Today
                      </Text>
                    </View>
                  </View>

                  {NAMAZ_PRAYERS.map((prayer) => {
                    const status = namazRecord.prayers[prayer.id] as string;

                    let cardStyle = {};
                    let iconColor = prayer.color;
                    let btnText = "Locked";
                    let btnStyle: any = styles.prayerBtnLocked;
                    let textColor = theme.text;
                    let btnTextColor = theme.subtext;

                    if (status === "offered") {
                      cardStyle = {
                        backgroundColor: "#10B981",
                        borderColor: "#059669",
                      };
                      iconColor = "#FFF";
                      textColor = "#FFF";
                      btnTextColor = "#FFF";
                      btnText = "Offered";
                      btnStyle = styles.prayerBtnDone;
                    } else if (status === "qazah") {
                      cardStyle = {
                        backgroundColor: theme.qazah,
                        borderColor: theme.qazah,
                      };
                      iconColor = "#FFF";
                      textColor = "#FFF";
                      btnTextColor = "#FFF";
                      btnText = "Qazah Done";
                      btnStyle = styles.prayerBtnDone;
                    } else if (status === "missed") {
                      cardStyle = { borderColor: theme.danger };
                      btnText = "Offer Qazah";
                      btnStyle = styles.prayerBtnMissed;
                      btnTextColor = "#FFF";
                    } else if (status === "pending") {
                      cardStyle = { borderColor: theme.brand };
                      btnText = "Offer Now";
                      btnStyle = styles.prayerBtnNext;
                      btnTextColor = "#FFF";
                    }

                    return (
                      <View
                        key={prayer.id}
                        style={[styles.prayerCard, cardStyle]}
                      >
                        <View style={styles.prayerInfo}>
                          <View
                            style={[
                              styles.prayerIconBox,
                              (status === "offered" || status === "qazah") && {
                                backgroundColor: "rgba(255,255,255,0.2)",
                              },
                            ]}
                          >
                            <Ionicons
                              name={prayer.icon as any}
                              size={24}
                              color={iconColor}
                            />
                          </View>
                          <Text
                            style={[styles.prayerName, { color: textColor }]}
                          >
                            {prayer.name}
                          </Text>
                        </View>

                        <TouchableOpacity
                          disabled={
                            status === "offered" ||
                            status === "qazah" ||
                            status === "locked"
                          }
                          onPress={() => handleNamazAction(prayer.id)}
                          style={[styles.prayerBtn, btnStyle]}
                        >
                          <Text
                            style={[
                              styles.prayerBtnText,
                              { color: btnTextColor },
                            ]}
                          >
                            {btnText}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

          {activeTab === "good" &&
            (goodHabits.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="flame-outline" size={64} color={theme.border} />
                <Text style={styles.emptyText}>
                  No active pursuits established.
                </Text>
              </View>
            ) : (
              goodHabits.map((habit) => {
                const today = new Date().setHours(0, 0, 0, 0);
                const checksToday = (habit.checkIns || []).filter(
                  (d: string) => new Date(d).setHours(0, 0, 0, 0) === today,
                ).length;
                const targetDaily = habit.targetPerDay || 1;
                const isCheckedInToday = checksToday >= targetDaily;

                const checkInsThisWeek = (habit.checkIns || []).filter(
                  isThisWeek,
                );
                const uniqueDaysThisWeek = new Set(
                  checkInsThisWeek.map((d: string) =>
                    new Date(d).setHours(0, 0, 0, 0),
                  ),
                ).size;
                const targetWeekly = habit.targetPerWeek || 7;
                const weeklyProgressPercent = Math.min(
                  100,
                  (uniqueDaysThisWeek / targetWeekly) * 100,
                );

                return (
                  <View
                    key={habit._id}
                    style={[styles.habitCard, styles.goodCard]}
                  >
                    <View style={styles.habitHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.habitName}>{habit.name}</Text>
                        <Text style={styles.streakText}>
                          <Ionicons name="flame" size={12} color="#F59E0B" />{" "}
                          {calculateStreak(habit.checkIns)} Day Streak
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <View style={styles.progressHeaderRow}>
                        <Text style={styles.progressHeaderLbl}>
                          DAILY PROGRESS
                        </Text>
                        <Text
                          style={[
                            styles.progressHeaderVal,
                            checksToday >= targetDaily && { color: "#10B981" },
                          ]}
                        >
                          {checksToday} / {targetDaily}
                        </Text>
                      </View>
                      <View style={styles.segmentsRow}>
                        {Array.from({ length: targetDaily }).map((_, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.segment,
                              {
                                backgroundColor:
                                  idx < checksToday ? "#10B981" : theme.border,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </View>

                    <View style={{ marginBottom: 20 }}>
                      <View style={styles.progressHeaderRow}>
                        <Text style={styles.progressHeaderLbl}>
                          WEEKLY TARGET
                        </Text>
                        <Text
                          style={[
                            styles.progressHeaderVal,
                            uniqueDaysThisWeek >= targetWeekly && {
                              color: theme.brand,
                            },
                          ]}
                        >
                          {uniqueDaysThisWeek} / {targetWeekly} Days
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.progressBarBg,
                          { backgroundColor: theme.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${weeklyProgressPercent}%`,
                              backgroundColor: theme.brand,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      disabled={isCheckedInToday}
                      onPress={() => executeHabitAction("checkin", habit._id)}
                      style={[
                        styles.actionBtnFull,
                        isCheckedInToday ? styles.btnDisabled : styles.btnGood,
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
                        {isCheckedInToday
                          ? "Objective Complete"
                          : "Log Progress"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ))}

          {activeTab === "bad" &&
            (badHabits.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="skull-outline" size={64} color={theme.border} />
                <Text style={styles.emptyText}>No vices being tracked.</Text>
              </View>
            ) : (
              badHabits.map((habit) => {
                const isModeration = habit.strategy === "moderation";
                const cheatsThisWeek = (habit.cheatDays || []).filter(
                  isWithinLast7Days,
                ).length;
                const allowancesLeft = Math.max(
                  0,
                  (habit.allowancePerWeek || 0) - cheatsThisWeek,
                );

                return (
                  <View
                    key={habit._id}
                    style={[styles.habitCard, styles.badCard]}
                  >
                    <View style={styles.habitHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.habitName}>{habit.name}</Text>
                        <View style={styles.strategyPill}>
                          <Text style={styles.strategyText}>
                            {isModeration
                              ? `Moderation (${allowancesLeft} Left)`
                              : "Zero Tolerance"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.timerLabel}>CLEAN SINCE</Text>
                    <LiveTimer startDate={habit.startDate} />

                    <View style={styles.badActions}>
                      {isModeration && (
                        <TouchableOpacity
                          disabled={allowancesLeft <= 0}
                          onPress={() =>
                            setConfirmModal({
                              visible: true,
                              action: "cheat",
                              habitId: habit._id,
                              title: "Use Allowance?",
                              message:
                                "Are you sure you want to use one of your allowed exceptions? Your streak will not reset.",
                              btnText: "Use Exception",
                              btnColor: "#F59E0B",
                            })
                          }
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
                            Use Exception
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() =>
                          setConfirmModal({
                            visible: true,
                            action: "reset",
                            habitId: habit._id,
                            title: "Relapse Detected",
                            message:
                              "This will completely reset your clean streak back to zero. Are you sure?",
                            btnText: "Confirm Relapse",
                            btnColor: "#E11D48",
                          })
                        }
                        style={[styles.actionBtn, styles.btnDanger]}
                      >
                        <Ionicons name="refresh" size={16} color="#FFF" />
                        <Text style={[styles.btnText, { color: "#FFF" }]}>
                          Relapse
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ))}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, paddingTop: 10 },
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
    activeTabNamaz: {
      backgroundColor: "#10B981",
      shadowColor: "#10B981",
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    activeTabGood: {
      backgroundColor: theme.brand,
      shadowColor: theme.brand,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    activeTabBad: {
      backgroundColor: "#F43F5E",
      shadowColor: "#F43F5E",
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    tabText: { fontSize: 13, fontWeight: "800", color: theme.subtext },
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
    animateFade: { opacity: 1 },
    namazHero: {
      backgroundColor: "#064E3B",
      padding: 24,
      borderRadius: 24,
      alignItems: "center",
      marginBottom: 16,
    },
    namazTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: "#FFF",
      marginBottom: 6,
    },
    namazSubtitle: {
      fontSize: 13,
      color: "#A7F3D0",
      textAlign: "center",
      fontStyle: "italic",
      marginBottom: 16,
      lineHeight: 20,
    },
    namazBadge: {
      backgroundColor: "rgba(16, 185, 129, 0.2)",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(16, 185, 129, 0.4)",
    },
    namazBadgeText: { color: "#10B981", fontWeight: "800", fontSize: 12 },
    prayerCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    prayerCardCompleted: { backgroundColor: "#10B981", borderColor: "#059669" },
    prayerInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
    prayerIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
    },
    prayerName: { fontSize: 18, fontWeight: "800", color: theme.text },
    prayerBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    prayerBtnNext: { backgroundColor: theme.brand },
    prayerBtnMissed: { backgroundColor: theme.danger },
    prayerBtnLocked: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    prayerBtnDone: { backgroundColor: "rgba(255,255,255,0.2)" },
    prayerBtnText: { fontSize: 13, fontWeight: "800" },
    habitCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    goodCard: { borderTopWidth: 4, borderTopColor: "#10B981" },
    badCard: { borderTopWidth: 4, borderTopColor: "#F43F5E" },
    habitHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    habitName: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    streakText: { fontSize: 12, fontWeight: "700", color: theme.subtext },
    strategyPill: {
      alignSelf: "flex-start",
      backgroundColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 4,
    },
    strategyText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      textTransform: "uppercase",
    },
    progressHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    progressHeaderLbl: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
    },
    progressHeaderVal: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
    },
    segmentsRow: { flexDirection: "row", gap: 6, height: 10 },
    segment: { flex: 1, borderRadius: 5 },
    progressBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
    progressBarFill: { height: "100%", borderRadius: 4 },
    timerLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
      marginTop: 4,
    },
    badActions: { flexDirection: "row", gap: 10, marginTop: 20 },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
    },
    actionBtnFull: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
    },
    btnGood: { backgroundColor: "#10B981" },
    btnWarn: { backgroundColor: "#F59E0B" },
    btnDanger: { backgroundColor: "#E11D48" },
    btnDisabled: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnText: { fontSize: 14, fontWeight: "800" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalBox: {
      width: "100%",
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalIconBg: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.text,
      marginBottom: 8,
      textAlign: "center",
    },
    modalSub: {
      fontSize: 14,
      color: theme.subtext,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
    },
    modalActions: { flexDirection: "row", gap: 12, width: "100%" },
    modalBtnCancel: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    modalBtnTextCancel: { color: theme.text, fontWeight: "800", fontSize: 15 },
    modalBtnConfirm: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    modalBtnTextConfirm: { color: "#FFF", fontWeight: "900", fontSize: 15 },
  });
