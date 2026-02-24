import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import UCPLogo from "../../components/UCPLogo";

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
    invertedSubtext: "#A3A3A3",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
    invertedSubtext: "#737373",
  },
};

const parseTimeStringToDate = (timeStr: string) => {
  if (!timeStr) return new Date();
  try {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  } catch (e) {
    return new Date();
  }
};

export default function HomeScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const todayDateStr = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
  const currentDayName = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  const [userName, setUserName] = useState("Student");
  const [stats, setStats] = useState({ cgpa: "0.00", credits: "0" });
  const [todaysClasses, setTodaysClasses] = useState<any[]>([]);
  const [nextClass, setNextClass] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const processTimetable = (allClasses: any[]) => {
    const todayList = allClasses
      .filter(
        (c: any) =>
          c.day && c.day.toLowerCase() === currentDayName.toLowerCase(),
      )
      .sort(
        (a: any, b: any) =>
          parseTimeStringToDate(a.startTime).getTime() -
          parseTimeStringToDate(b.startTime).getTime(),
      );

    setTodaysClasses(todayList);
    const now = new Date();
    const upcoming = todayList.find(
      (c: any) => parseTimeStringToDate(c.startTime) > now,
    );

    if (upcoming) {
      const diffMs =
        parseTimeStringToDate(upcoming.startTime).getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      let startsIn = hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} mins`;
      setNextClass({ ...upcoming, startsIn });
    } else {
      setNextClass(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // --- 1. INSTANT OFFLINE LOAD ---
      const [cUser, cStats, cTime, cTasks] = await Promise.all([
        AsyncStorage.getItem("off_dash_user"),
        AsyncStorage.getItem("off_dash_stats"),
        AsyncStorage.getItem("off_dash_time"),
        AsyncStorage.getItem("off_dash_tasks"),
      ]);

      if (cUser) setUserName(JSON.parse(cUser));
      if (cStats) setStats(JSON.parse(cStats));
      if (cTime) processTimetable(JSON.parse(cTime));
      if (cTasks) setTasks(JSON.parse(cTasks));

      if (cUser || cTime || cTasks) setIsLoading(false); // Drop loading screen instantly if we have cache

      // --- 2. FETCH FRESH SERVER DATA ---
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) return setIsLoading(false);

      const config = { headers: { "x-auth-token": token } };
      const results = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/auth/user`, config),
        axios.get(`${BACKEND_URL}/student-stats`, config),
        axios.get(`${BACKEND_URL}/timetable`, config),
        axios.get(`${BACKEND_URL}/tasks`, config),
      ]);

      // --- 3. UPDATE UI & SAVE TO CACHE ---
      if (results[0].status === "fulfilled" && results[0].value.data.name) {
        setUserName(results[0].value.data.name);
        AsyncStorage.setItem(
          "off_dash_user",
          JSON.stringify(results[0].value.data.name),
        );
      }
      if (results[1].status === "fulfilled" && !results[1].value.data.message) {
        const freshStats = {
          cgpa: results[1].value.data.cgpa || "0.00",
          credits: results[1].value.data.credits || "0",
        };
        setStats(freshStats);
        AsyncStorage.setItem("off_dash_stats", JSON.stringify(freshStats));
      }
      if (results[2].status === "fulfilled") {
        processTimetable(results[2].value.data || []);
        AsyncStorage.setItem(
          "off_dash_time",
          JSON.stringify(results[2].value.data || []),
        );
      }
      if (results[3].status === "fulfilled") {
        const freshTasks = Array.isArray(results[3].value.data)
          ? results[3].value.data
          : [];
        setTasks(freshTasks);
        AsyncStorage.setItem("off_dash_tasks", JSON.stringify(freshTasks));
      }
    } catch (error) {
      console.log("Offline mode active.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const activeTasks = tasks
    .filter((t) => !t.completed)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const completedTodayTasks = tasks.filter(
    (t) =>
      t.completed &&
      new Date(t.updatedAt || t.createdAt).toDateString() ===
        new Date().toDateString(),
  );
  const actionItems = activeTasks.slice(0, 4);
  const totalTasksScope = activeTasks.length + completedTodayTasks.length;

  const toggleTaskCompletion = async (taskId: string) => {
    setCompletingId(taskId);
    setTimeout(async () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newTasks = tasks.map((t) =>
        t._id === taskId
          ? {
              ...t,
              completed: true,
              status: "Completed",
              updatedAt: new Date().toISOString(),
            }
          : t,
      );
      setTasks(newTasks);
      setCompletingId(null);
      // Cache optimistic update instantly
      AsyncStorage.setItem("off_dash_tasks", JSON.stringify(newTasks));

      try {
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
        const token = await AsyncStorage.getItem("userToken");
        await axios.put(
          `${BACKEND_URL}/tasks/${taskId}`,
          { completed: true, status: "Completed" },
          { headers: { "x-auth-token": token } },
        );
      } catch (error) {
        fetchDashboardData();
      }
    }, 400);
  };

  return (
    <View style={styles.safeArea}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text}
            />
          }
        >
          <View style={styles.dashboardInfo}>
            <Text style={styles.dateText}>{todayDateStr}</Text>
            <Text style={styles.greeting}>Hey, {userName}</Text>
          </View>

          <View style={styles.bentoContainer}>
            <View
              style={[
                styles.bentoBox,
                styles.heroBox,
                !nextClass && {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.heroHeader}>
                <View
                  style={[
                    styles.liveBadge,
                    !nextClass && {
                      backgroundColor: "transparent",
                      paddingHorizontal: 0,
                    },
                  ]}
                >
                  {nextClass && <View style={styles.liveDot} />}
                  <Text
                    style={[
                      styles.liveText,
                      !nextClass && { color: theme.subtext },
                    ]}
                  >
                    {nextClass ? "UP NEXT" : "STATUS"}
                  </Text>
                </View>
                <Ionicons
                  name={nextClass ? "notifications" : "cafe"}
                  size={20}
                  color={nextClass ? theme.invertedText : theme.subtext}
                />
              </View>
              <Text
                style={[styles.heroTitle, !nextClass && { color: theme.text }]}
              >
                {nextClass
                  ? nextClass.courseName || nextClass.name
                  : "All clear for now."}
              </Text>
              <Text
                style={[styles.heroSub, !nextClass && { color: theme.subtext }]}
              >
                {nextClass
                  ? `Starts in ${nextClass.startsIn} • Room ${nextClass.room || "TBD"}`
                  : "Enjoy your free time or crush some tasks."}
              </Text>
            </View>

            <View style={styles.subGrid}>
              <View style={[styles.bentoBox, styles.halfBox]}>
                <Ionicons
                  name="school-outline"
                  size={24}
                  color={theme.text}
                  style={styles.bentoIcon}
                />
                <Text style={styles.bentoValue}>{stats.cgpa}</Text>
                <Text style={styles.bentoLabel}>Current CGPA</Text>
              </View>
              <View style={[styles.bentoBox, styles.halfBox]}>
                <Ionicons
                  name="checkbox-outline"
                  size={24}
                  color={theme.text}
                  style={styles.bentoIcon}
                />
                <Text style={styles.bentoValue}>
                  {completedTodayTasks.length}
                  {totalTasksScope > 0 ? `/${totalTasksScope}` : ""}
                </Text>
                <Text style={styles.bentoLabel}>Tasks Done</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
          </View>
          <View style={styles.timelineContainer}>
            {todaysClasses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={32}
                  color={theme.border}
                />
                <Text style={styles.emptyText}>
                  No classes scheduled for today.
                </Text>
              </View>
            ) : (
              todaysClasses.map((cls, index) => (
                <View key={cls._id || index} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineTime}>{cls.startTime}</Text>
                    {index !== todaysClasses.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                    <View style={styles.timelineDot} />
                  </View>
                  <View style={styles.timelineCard}>
                    <View style={styles.courseHeaderRow}>
                      <UCPLogo
                        width={18}
                        height={18}
                        color={theme.text}
                        style={styles.ucpIcon}
                      />
                      <Text style={styles.className} numberOfLines={1}>
                        {cls.courseName || cls.name}
                      </Text>
                    </View>
                    <View style={styles.classFooter}>
                      <Text style={styles.classDuration}>
                        {cls.startTime} - {cls.endTime}
                      </Text>
                      <View style={styles.roomBadge}>
                        <Text style={styles.roomText}>{cls.room || "TBD"}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Action Items</Text>
          </View>
          <View style={styles.taskList}>
            {actionItems.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={styles.emptyText}>
                  No pending tasks. You're awesome!
                </Text>
              </View>
            ) : (
              actionItems.map((task, index) => {
                const isCompleting = task._id === completingId;
                return (
                  <TouchableOpacity
                    key={task._id}
                    activeOpacity={0.7}
                    onPress={() => toggleTaskCompletion(task._id)}
                    style={[
                      styles.taskRow,
                      index === actionItems.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isCompleting && styles.checkboxDone,
                      ]}
                    >
                      {isCompleting && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={theme.invertedText}
                        />
                      )}
                    </View>
                    <View style={styles.taskInfo}>
                      <Text
                        style={[
                          styles.taskText,
                          isCompleting && styles.taskTextDone,
                        ]}
                        numberOfLines={1}
                      >
                        {task.name}
                      </Text>
                      <Text style={styles.taskCourse}>
                        {task.course || "General"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.priorityDot,
                        {
                          backgroundColor:
                            task.priority === "Critical"
                              ? "#EF4444"
                              : task.priority === "High"
                                ? "#F59E0B"
                                : "transparent",
                        },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingTop: 20, paddingBottom: 100 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    dashboardInfo: { paddingHorizontal: 24, marginBottom: 25 },
    dateText: {
      color: theme.subtext,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    greeting: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -1,
    },
    bentoContainer: { paddingHorizontal: 24, gap: 16, marginBottom: 35 },
    bentoBox: {
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    heroBox: {
      backgroundColor: theme.invertedBg,
      borderColor: theme.invertedBg,
      padding: 24,
    },
    heroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.invertedText,
    },
    liveText: {
      color: theme.invertedText,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: theme.invertedText,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    heroSub: { fontSize: 15, color: theme.invertedSubtext, fontWeight: "500" },
    subGrid: { flexDirection: "row", gap: 16 },
    halfBox: { flex: 1, height: 140, justifyContent: "space-between" },
    bentoIcon: { marginBottom: 10 },
    bentoValue: {
      fontSize: 28,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -1,
    },
    bentoLabel: { fontSize: 13, color: theme.subtext, fontWeight: "600" },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingHorizontal: 24,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
    },
    timelineContainer: { paddingHorizontal: 24, paddingBottom: 35 },
    timelineRow: { flexDirection: "row", marginBottom: 16 },
    timelineLeft: { width: 70, alignItems: "center", marginRight: 15 },
    timelineTime: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    timelineDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.invertedBg,
      position: "absolute",
      top: 22,
    },
    timelineLine: {
      width: 2,
      backgroundColor: theme.border,
      position: "absolute",
      top: 34,
      bottom: -20,
    },
    timelineCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    courseHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    ucpIcon: { marginRight: 8 },
    className: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      flex: 1,
    },
    classFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    classDuration: { fontSize: 13, fontWeight: "600", color: theme.subtext },
    roomBadge: {
      backgroundColor: theme.background,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    roomText: { color: theme.text, fontSize: 11, fontWeight: "800" },
    emptyContainer: { alignItems: "center", paddingVertical: 20, gap: 10 },
    emptyText: { color: theme.subtext, fontSize: 14, fontWeight: "600" },
    taskList: {
      marginHorizontal: 24,
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 8,
    },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 16,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxDone: {
      backgroundColor: theme.invertedBg,
      borderColor: theme.invertedBg,
    },
    taskInfo: { flex: 1 },
    taskText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    taskTextDone: {
      textDecorationLine: "line-through",
      color: theme.subtext,
      fontStyle: "italic",
    },
    taskCourse: { fontSize: 13, color: theme.subtext, fontWeight: "600" },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
  });
