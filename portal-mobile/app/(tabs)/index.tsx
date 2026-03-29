import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react"; // <-- FIXED: useMemo imported
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
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

// --- Extended Vibrant Theme ---
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
    danger: "#EF4444",
    brand: "#3B82F6",
    success: "#10B981",
    // Vibrant Accents
    emerald: "#10B981",
    emeraldBg: "#D1FAE5",
    rose: "#F43F5E",
    roseBg: "#FFE4E6",
    amber: "#F59E0B",
    amberBg: "#FEF3C7",
    blue: "#3B82F6",
    blueBg: "#DBEAFE",
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
    danger: "#F87171",
    brand: "#60A5FA",
    success: "#34D399",
    // Vibrant Accents
    emerald: "#34D399",
    emeraldBg: "rgba(16, 185, 129, 0.15)",
    rose: "#FB7185",
    roseBg: "rgba(244, 63, 94, 0.15)",
    amber: "#FBBF24",
    amberBg: "rgba(245, 158, 11, 0.15)",
    blue: "#60A5FA",
    blueBg: "rgba(59, 130, 246, 0.15)",
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
  const [courses, setCourses] = useState<any[]>([]);

  // NEW STATES FOR DASHBOARD
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [submissionsData, setSubmissionsData] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

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
      const [cUser, cStats, cTime, cTasks, cCourses, cAtt, cSub] =
        await Promise.all([
          AsyncStorage.getItem("off_dash_user"),
          AsyncStorage.getItem("off_dash_stats"),
          AsyncStorage.getItem("off_dash_time"),
          AsyncStorage.getItem("off_dash_tasks"),
          AsyncStorage.getItem("off_dash_courses"),
          AsyncStorage.getItem("off_dash_att"),
          AsyncStorage.getItem("off_dash_sub"),
        ]);

      if (cUser) setUserName(JSON.parse(cUser));
      if (cStats) setStats(JSON.parse(cStats));
      if (cTime) processTimetable(JSON.parse(cTime));
      if (cTasks) setTasks(JSON.parse(cTasks));
      if (cCourses) setCourses(JSON.parse(cCourses));
      if (cAtt) setAttendanceData(JSON.parse(cAtt));
      if (cSub) setSubmissionsData(JSON.parse(cSub));

      if (cUser || cTime || cTasks) setIsLoading(false);

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) return setIsLoading(false);

      const config = {
        headers: {
          "x-auth-token": token,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        timeout: 5000,
      };

      const timestamp = Date.now();
      const results = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/auth/user?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/student-stats?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/timetable?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/tasks?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/courses?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/attendance?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/submissions?t=${timestamp}`, config),
      ]);

      const isAnyRejected = results.some((r) => r.status === "rejected");
      setIsOffline(isAnyRejected);

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
      if (results[4].status === "fulfilled") {
        const freshCourses = Array.isArray(results[4].value.data)
          ? results[4].value.data
          : [];
        setCourses(freshCourses);
        AsyncStorage.setItem("off_dash_courses", JSON.stringify(freshCourses));
      }
      if (results[5].status === "fulfilled") {
        const freshAtt = Array.isArray(results[5].value.data)
          ? results[5].value.data
          : [];
        setAttendanceData(freshAtt);
        AsyncStorage.setItem("off_dash_att", JSON.stringify(freshAtt));
      }
      if (results[6].status === "fulfilled") {
        const freshSub = Array.isArray(results[6].value.data)
          ? results[6].value.data
          : [];
        setSubmissionsData(freshSub);
        AsyncStorage.setItem("off_dash_sub", JSON.stringify(freshSub));
      }
    } catch (error) {
      setIsOffline(true);
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

  // --- SMART DASHBOARD FILTERING (Past + Current Week ONLY) ---
  const getStartOfWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getEndOfWeek = () => {
    const start = getStartOfWeek();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const getTaskTime = (t: any) => {
    if (t.date) {
      const [y, m, d] = t.date.split("-");
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
    }
    return new Date(t.createdAt).getTime();
  };

  const startOfWeekTime = getStartOfWeek().getTime();
  const endOfWeekTime = getEndOfWeek().getTime();

  const incompleteTasks = tasks.filter((t: any) => !t.completed);
  const previousTasks = incompleteTasks
    .filter((t: any) => getTaskTime(t) < startOfWeekTime)
    .sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const currentWeekTasks = incompleteTasks
    .filter((t: any) => {
      const time = getTaskTime(t);
      return time >= startOfWeekTime && time <= endOfWeekTime;
    })
    .sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const activeTasks = [...previousTasks, ...currentWeekTasks];
  const actionItems = activeTasks.slice(0, 5);
  const completedTodayTasks = tasks.filter(
    (t: any) =>
      t.completed &&
      new Date(t.updatedAt || t.createdAt).toDateString() ===
        new Date().toDateString(),
  );
  const totalTasksScope = activeTasks.length + completedTodayTasks.length;

  const toggleTaskCompletion = async (taskId: string) => {
    setCompletingId(taskId);
    setTimeout(async () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newTasks = tasks.map((t: any) =>
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

  const getCourseIcon = (courseName: string) => {
    if (!courseName || courseName === "General")
      return <Ionicons name="book" size={14} color={theme.subtext} />;
    const matchedCourse = courses.find((c: any) => c.name === courseName);
    if (
      matchedCourse &&
      (matchedCourse.type === "university" || matchedCourse.type === "uni")
    ) {
      return <UCPLogo width={14} height={14} color={theme.text} />;
    }
    return <Ionicons name="book" size={14} color={theme.subtext} />;
  };

  // --- FIXED: BULLETPROOF TYPESCRIPT FOR ATTENDANCE ALERTS (< 75%) ---
  const lowAttendanceCourses = useMemo(() => {
    return attendanceData
      .map((att: any) => {
        if (!att?.summary || att.summary.conducted === 0) return null;
        const conducted = att.summary.conducted;
        const attended = att.summary.attended;
        const absents = conducted - attended;
        const percentage = (attended / conducted) * 100;
        const remainingAbsents = Math.max(0, 13 - absents);

        if (percentage < 75) {
          return {
            name: att.courseName,
            percentage,
            absents,
            remainingAbsents,
          };
        }
        return null;
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => a.percentage - b.percentage);
  }, [attendanceData]);

  // --- FIXED: BULLETPROOF TYPESCRIPT FOR PENDING SUBMISSIONS ---
  const activeSubmissions = useMemo(() => {
    let pending: any[] = [];
    submissionsData.forEach((sub: any) => {
      if (sub?.tasks) {
        sub.tasks.forEach((task: any) => {
          const statusStr = task?.status || "";
          const isSubmitted = statusStr.toLowerCase().includes("submitted");
          const dueObj = task?.dueDate ? new Date(task.dueDate) : new Date(0);

          if (!isSubmitted && dueObj.getTime() > new Date().getTime()) {
            pending.push({ ...task, courseName: sub.courseName });
          }
        });
      }
    });
    return pending.sort((a: any, b: any) => {
      const timeA = a?.dueDate ? new Date(a.dueDate).getTime() : 0;
      const timeB = b?.dueDate ? new Date(b.dueDate).getTime() : 0;
      return timeA - timeB;
    });
  }, [submissionsData]);

  const getDaysLeft = (dueDate: string) => {
    if (!dueDate) return "Unknown Deadline";
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 3600 * 24),
    );
    if (diffDays === 0) return "Due Today";
    if (diffDays === 1) return "Due Tomorrow";
    return `Due in ${diffDays} days`;
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
            <View>
              <Text style={styles.dateText}>{todayDateStr}</Text>
              <Text style={styles.greeting}>Hey, {userName}</Text>
            </View>
            {isOffline && (
              <View style={styles.offlinePill}>
                <Ionicons name="cloud-offline" size={12} color="#EF4444" />
                <Text style={styles.offlineText}>Offline</Text>
              </View>
            )}
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

          {/* --- NEW: ATTENDANCE ALERTS (<75%) --- */}
          {lowAttendanceCourses.length > 0 && (
            <View style={{ marginBottom: 30 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Attendance Alerts</Text>
                <Ionicons name="warning" size={20} color={theme.rose} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.alertsScrollContainer}
              >
                {lowAttendanceCourses.map((course: any, idx: number) => {
                  const isCritical = course.percentage < 60;
                  const cardColor = isCritical ? theme.rose : theme.amber;
                  const bgTint = isCritical ? theme.roseBg : theme.amberBg;

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.alertCard,
                        { borderLeftColor: cardColor, borderLeftWidth: 4 },
                      ]}
                    >
                      <Text style={styles.alertCourseName} numberOfLines={2}>
                        {course.name}
                      </Text>
                      <View style={styles.alertMainRow}>
                        <Text
                          style={[styles.alertPercentage, { color: cardColor }]}
                        >
                          {course.percentage.toFixed(0)}%
                        </Text>
                        <View
                          style={[
                            styles.absentsPill,
                            { backgroundColor: bgTint },
                          ]}
                        >
                          <Text
                            style={[
                              styles.absentsPillText,
                              { color: cardColor },
                            ]}
                          >
                            {course.remainingAbsents} Absents Left
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.alertMeta}>
                        You have taken {course.absents} out of 13 allowed
                        absences.
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* --- NEW: PENDING SUBMISSIONS --- */}
          {activeSubmissions.length > 0 && (
            <View style={{ marginBottom: 30 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pending Submissions</Text>
              </View>
              <View style={styles.taskList}>
                {activeSubmissions.slice(0, 3).map((sub: any, idx: number) => {
                  const daysLeftText = getDaysLeft(sub.dueDate);
                  const isUrgent =
                    daysLeftText.includes("Today") ||
                    daysLeftText.includes("Tomorrow");

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.7}
                      onPress={() =>
                        sub.submissionUrl && Linking.openURL(sub.submissionUrl)
                      }
                      style={[
                        styles.taskRow,
                        idx === Math.min(activeSubmissions.length, 3) - 1 && {
                          borderBottomWidth: 0,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.subIconBox,
                          {
                            backgroundColor: isUrgent
                              ? theme.roseBg
                              : theme.blueBg,
                          },
                        ]}
                      >
                        <Ionicons
                          name="document-text"
                          size={16}
                          color={isUrgent ? theme.rose : theme.blue}
                        />
                      </View>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskText} numberOfLines={1}>
                          {sub.title}
                        </Text>
                        <Text style={styles.taskCourse} numberOfLines={1}>
                          {sub.courseName}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={[
                            styles.subDate,
                            isUrgent && {
                              color: theme.rose,
                              fontWeight: "800",
                            },
                          ]}
                        >
                          {daysLeftText}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

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
              todaysClasses.map((cls: any, index: number) => (
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
              actionItems.map((task: any, index: number) => {
                const isCompleting = task._id === completingId;
                const isOverdue = getTaskTime(task) < startOfWeekTime;

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
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {getCourseIcon(task.course)}
                        <Text style={styles.taskCourse}>
                          {task.course || "General"}
                        </Text>
                        {isOverdue && (
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "800",
                              color: theme.danger,
                              marginLeft: 4,
                            }}
                          >
                            PAST DUE
                          </Text>
                        )}
                      </View>
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
    dashboardInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      marginBottom: 25,
    },
    offlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    offlineText: { color: "#EF4444", fontSize: 11, fontWeight: "800" },
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

    // --- ATTENDANCE ALERTS ---
    alertsScrollContainer: { paddingHorizontal: 24, gap: 12 },
    alertCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      padding: 16,
      width: 260,
    },
    alertCourseName: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 12,
    },
    alertMainRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    alertPercentage: { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
    absentsPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    absentsPillText: { fontSize: 11, fontWeight: "800" },
    alertMeta: { fontSize: 11, color: theme.subtext, fontWeight: "600" },

    // --- PENDING SUBMISSIONS ---
    subIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    subDate: { fontSize: 12, color: theme.subtext, fontWeight: "600" },
  });
