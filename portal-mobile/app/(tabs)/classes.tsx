import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Notifications from "expo-notifications";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

// IMPORT YOUR CUSTOM UCP LOGO
import UCPLogo from "../../components/UCPLogo";

// --- SMART SCHEDULING ENGINE ---
export async function scheduleSmartAlert(
  title: string,
  body: string,
  exactDate: Date,
  eventId: string,
  type: "task" | "class",
) {
  const offsetMinutes = type === "task" ? 15 : 5;
  const warningDate = new Date(exactDate.getTime() - offsetMinutes * 60000);

  // 1. Schedule the Early Warning (with the Acknowledge button)
  if (warningDate > new Date()) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${eventId}-warning`,
      content: {
        title: `⏳ Upcoming: ${title}`,
        body: body,
        categoryIdentifier: "smart-alert",
        data: { eventId, type: "warning" },
        sound: true,
      },
      trigger: warningDate as any, // <-- TS Override
    });
  }

  // 2. Schedule the Exact Time Fallback
  if (exactDate > new Date()) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${eventId}-exact`,
      content: {
        title: `🔴 NOW: ${title}`,
        body: `It's time to start!`,
        data: { eventId, type: "exact" },
        sound: true,
      },
      trigger: exactDate as any, // <-- TS Override
    });
  }
}

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

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DEGREE_TOTAL_CREDITS = 133;

const SUB_TABS = [
  { id: "courses", label: "Courses", icon: "library" },
  { id: "timetable", label: "Timetable", icon: "calendar" },
  { id: "grades", label: "Grades", icon: "school" },
  { id: "history", label: "History", icon: "time" },
] as const;

// Helper Functions
const isBelowAverage = (obtained: string, average: string) => {
  const obt = parseFloat(obtained);
  const avg = parseFloat(average);
  if (isNaN(obt) || isNaN(avg)) return false;
  return obt < avg;
};

const getGradeColor = (grade: string) => {
  const dangerGrades = ["C-", "D+", "D", "F", "W"];
  if (dangerGrades.includes(grade)) return "#EF4444"; // Red
  return "#3B82F6"; // Blue
};

export default function ClassesScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [activeTab, setActiveTab] = useState<
    "courses" | "timetable" | "grades" | "history"
  >("courses");
  const [selectedDay, setSelectedDay] = useState("Monday");

  // Data States
  const [courses, setCourses] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<any>({
    cgpa: "0.00",
    credits: "0",
    inprogressCr: "0",
  });

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGrades, setExpandedGrades] = useState<{
    [key: string]: boolean;
  }>({});
  const [expandedHistory, setExpandedHistory] = useState<{
    [key: string]: boolean;
  }>({});

  // --- BIND ALARMS FOR TODAY'S CLASSES ---
  const syncClassNotifications = async (timetableList: any[]) => {
    const generalNotifs = await AsyncStorage.getItem("generalNotifs");
    if (generalNotifs !== "true") return;

    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    });
    const todaysClasses = timetableList.filter(
      (c) => c.day && c.day.toLowerCase() === todayStr.toLowerCase(),
    );

    for (const session of todaysClasses) {
      if (!session.startTime) continue;
      try {
        // Parse time formats like "09:00 AM" or "14:30"
        const timeMatch = session.startTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const modifier = timeMatch[3];
          if (modifier && modifier.toUpperCase() === "PM" && hours < 12)
            hours += 12;
          if (modifier && modifier.toUpperCase() === "AM" && hours === 12)
            hours = 0;

          const exactDate = new Date();
          exactDate.setHours(hours, minutes, 0, 0);

          if (exactDate > new Date()) {
            await scheduleSmartAlert(
              session.courseName || session.name,
              `Class starts in 5 minutes! Room: ${
                session.room || "TBD"
              }. Acknowledge to mute final alarm.`,
              exactDate,
              `class-${session._id}`,
              "class",
            );
          }
        }
      } catch (e) {}
    }
  };

  const fetchData = async () => {
    try {
      // --- 1. INSTANT OFFLINE LOAD ---
      const [cCourses, cTime, cGrades, cHist, cStats] = await Promise.all([
        AsyncStorage.getItem("off_acad_courses"),
        AsyncStorage.getItem("off_acad_time"),
        AsyncStorage.getItem("off_acad_grades"),
        AsyncStorage.getItem("off_acad_history"),
        AsyncStorage.getItem("off_acad_stats"),
      ]);

      if (cCourses) setCourses(JSON.parse(cCourses));
      if (cTime) setTimetable(JSON.parse(cTime));
      if (cGrades) setGrades(JSON.parse(cGrades));
      if (cHist) setHistory(JSON.parse(cHist));
      if (cStats) setStudentStats(JSON.parse(cStats));

      if (cCourses || cHist) setIsLoading(false);

      // --- 2. FETCH FRESH SERVER DATA ---
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!BACKEND_URL) return;

      const token = await AsyncStorage.getItem("userToken");
      const config = { headers: { "x-auth-token": token } };

      const results = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/courses`, config),
        axios.get(`${BACKEND_URL}/timetable`, config),
        axios.get(`${BACKEND_URL}/grades`, config),
        axios.get(`${BACKEND_URL}/results-history`, config),
        axios.get(`${BACKEND_URL}/student-stats`, config),
      ]);

      // --- 3. UPDATE UI & SAVE TO CACHE ---
      if (results[0].status === "fulfilled") {
        setCourses(results[0].value.data || []);
        AsyncStorage.setItem(
          "off_acad_courses",
          JSON.stringify(results[0].value.data || []),
        );
      }
      if (results[1].status === "fulfilled") {
        const freshTimetable = results[1].value.data || [];
        setTimetable(freshTimetable);
        AsyncStorage.setItem("off_acad_time", JSON.stringify(freshTimetable));

        // 4. Sync Alarms automatically
        syncClassNotifications(freshTimetable);
      }
      if (results[2].status === "fulfilled") {
        setGrades(
          Array.isArray(results[2].value.data) ? results[2].value.data : [],
        );
        AsyncStorage.setItem(
          "off_acad_grades",
          JSON.stringify(
            Array.isArray(results[2].value.data) ? results[2].value.data : [],
          ),
        );
      }
      if (results[3].status === "fulfilled") {
        setHistory(
          Array.isArray(results[3].value.data) ? results[3].value.data : [],
        );
        AsyncStorage.setItem(
          "off_acad_history",
          JSON.stringify(
            Array.isArray(results[3].value.data) ? results[3].value.data : [],
          ),
        );
      }
      if (results[4].status === "fulfilled" && !results[4].value.data.message) {
        setStudentStats(results[4].value.data);
        AsyncStorage.setItem(
          "off_acad_stats",
          JSON.stringify(results[4].value.data),
        );
      }
    } catch (error) {
      console.log("Offline mode active.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    });
    if (WEEK_DAYS.includes(todayStr)) setSelectedDay(todayStr);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const historyStatsObj = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return null;
    const parse = (val: any) => parseFloat(val) || 0.0;
    const currentCGPA = studentStats?.cgpa
      ? parse(studentStats.cgpa)
      : parse(history[history.length - 1]?.cgpa);

    let best = { sgpa: -1, term: "" };
    let totalCredits = 0;

    history.forEach((sem) => {
      const s = parse(sem.sgpa);
      if (s > best.sgpa) best = { sgpa: s, term: sem.term };
      totalCredits += parse(sem.earnedCH);
    });

    const displayCredits = studentStats?.credits
      ? parse(studentStats.credits)
      : totalCredits;
    return {
      currentCGPA,
      best,
      totalCredits: displayCredits,
      totalSemesters: history.length,
    };
  }, [history, studentStats]);

  const toggleGradeRow = (courseId: string, idx: number) => {
    const key = `${courseId}-${idx}`;
    setExpandedGrades((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleHistoryRow = (idx: number) => {
    setExpandedHistory((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // --- RENDERERS ---

  const renderCourses = () => {
    const uniCourses = courses.filter(
      (c: any) => c.type === "university" || c.type === "uni",
    );
    const generalCourses = courses.filter(
      (c: any) => c.type === "general" && c.name !== "General Task",
    );

    if (uniCourses.length === 0 && generalCourses.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={48} color={theme.border} />
          <Text style={styles.emptyText}>No courses found.</Text>
        </View>
      );
    }

    return (
      <View style={styles.gridContainer}>
        {uniCourses.length > 0 && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeading}>Synced University Courses</Text>
            {uniCourses.map((course: any, index: number) => {
              const instructorNames =
                Array.isArray(course.instructors) &&
                course.instructors.length > 0
                  ? course.instructors.join(" • ")
                  : "Instructor TBD";
              const roomNames =
                Array.isArray(course.rooms) && course.rooms.length > 0
                  ? course.rooms.join(", ")
                  : "Room TBD";

              return (
                <View
                  key={course._id || `uni-${index}`}
                  style={styles.courseCard}
                >
                  <View style={styles.courseHeader}>
                    <View style={styles.titleWrapper}>
                      <UCPLogo width={24} height={24} color={theme.text} />
                      <Text style={styles.courseName} numberOfLines={2}>
                        {course.name}
                      </Text>
                    </View>
                    <Text style={styles.courseCode}>
                      {course.code || "UCP-SYNC"}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="person-outline"
                        size={14}
                        color={theme.subtext}
                      />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {instructorNames}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="business-outline"
                        size={14}
                        color={theme.subtext}
                      />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {roomNames}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.courseFooter}>
                    <View style={styles.syncedBadge}>
                      <Ionicons
                        name="shield-checkmark"
                        size={10}
                        color={theme.subtext}
                      />
                      <Text style={styles.syncedText}>OFFICIAL SYNC</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderTimetable = () => {
    const dayClasses = timetable.filter(
      (session: any) =>
        session.day && session.day.toLowerCase() === selectedDay.toLowerCase(),
    );
    return (
      <View style={styles.timetableWrapper}>
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daySelectorContainer}
          >
            {WEEK_DAYS.map((day) => {
              const isActive = selectedDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDay(day)}
                  style={[styles.dayPill, isActive && styles.activeDayPill]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      isActive && styles.activeDayPillText,
                    ]}
                  >
                    {day.substring(0, 3).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <View style={styles.timelineContainer}>
          {dayClasses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cafe-outline" size={48} color={theme.border} />
              <Text style={styles.emptyText}>No classes scheduled.</Text>
            </View>
          ) : (
            dayClasses.map((session: any, index: number) => (
              <View key={session._id || index} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <Text style={styles.timelineTime}>
                    {session.startTime || "TBD"}
                  </Text>
                  {index !== dayClasses.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                  <View style={styles.timelineDot} />
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.sessionHeaderRow}>
                    <UCPLogo
                      width={18}
                      height={18}
                      color={theme.text}
                      style={styles.ucpIcon}
                    />
                    <Text style={styles.sessionName} numberOfLines={1}>
                      {session.courseName || session.name}
                    </Text>
                  </View>
                  <View style={styles.sessionFooter}>
                    <View style={styles.sessionDetail}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={theme.subtext}
                      />
                      <Text style={styles.sessionDetailText}>
                        {session.startTime} - {session.endTime}
                      </Text>
                    </View>
                    <View style={styles.roomBadge}>
                      <Text style={styles.roomText}>
                        {session.room || "TBD"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderGradeBook = () => {
    return (
      <View style={styles.tabContentWrapper}>
        {/* STATS BENTO ROW */}
        <View style={styles.bentoRow}>
          <View
            style={[
              styles.bentoBox,
              styles.bentoFull,
              { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
            ]}
          >
            <Text
              style={[styles.bentoLabel, { color: "rgba(255,255,255,0.7)" }]}
            >
              CURRENT CGPA
            </Text>
            <Text style={[styles.bentoValueLg, { color: "#FFFFFF" }]}>
              {studentStats.cgpa || "0.00"}
            </Text>
            <Ionicons
              name="school"
              size={40}
              color="rgba(255,255,255,0.15)"
              style={{ position: "absolute", right: 10, bottom: 10 }}
            />
          </View>
          <View style={styles.bentoRowInner}>
            <View style={[styles.bentoBox, styles.bentoHalf]}>
              <Text style={styles.bentoLabel}>INPROGRESS</Text>
              <Text style={[styles.bentoValueSm, { color: "#10B981" }]}>
                {studentStats.inprogressCr || "0"} Cr
              </Text>
            </View>
            <View style={[styles.bentoBox, styles.bentoHalf]}>
              <Text style={styles.bentoLabel}>COMPLETED</Text>
              <Text style={[styles.bentoValueSm, { color: "#F59E0B" }]}>
                {studentStats.credits || "0"} Cr
              </Text>
            </View>
          </View>
        </View>

        {grades.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={48}
              color={theme.border}
            />
            <Text style={styles.emptyText}>No grades synced yet.</Text>
          </View>
        ) : (
          grades.map((course: any) => (
            <View key={course._id} style={styles.acadCard}>
              <View style={styles.acadHeader}>
                <View style={styles.titleWrapper}>
                  <UCPLogo width={20} height={20} color="#3B82F6" />
                  <Text style={styles.courseName} numberOfLines={2}>
                    {course.courseName}
                  </Text>
                </View>
                {course.totalPercentage && course.totalPercentage !== "0" && (
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreBadgeText}>
                      {course.totalPercentage}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.acadBody}>
                {course.assessments.map((item: any, idx: number) => {
                  const isExpanded = expandedGrades[`${course._id}-${idx}`];
                  const hasDetails = item.details && item.details.length > 0;
                  const percValue = parseFloat(item.percentage) || 0;

                  return (
                    <View key={idx}>
                      <TouchableOpacity
                        activeOpacity={hasDetails ? 0.7 : 1}
                        onPress={() =>
                          hasDetails && toggleGradeRow(course._id, idx)
                        }
                        style={styles.assessmentRow}
                      >
                        <View style={{ flex: 1, paddingRight: 20 }}>
                          <Text style={styles.assName}>{item.name}</Text>
                          {item.weight && (
                            <Text style={styles.assWeight}>
                              Weight: {item.weight}
                            </Text>
                          )}

                          {/* Inner Mini Progress Bar */}
                          <View style={styles.miniBarBg}>
                            <View
                              style={[
                                styles.miniBarFill,
                                {
                                  width: `${Math.min(percValue, 100)}%`,
                                  backgroundColor:
                                    percValue >= 80
                                      ? "#10B981"
                                      : percValue >= 60
                                        ? "#F59E0B"
                                        : "#EF4444",
                                },
                              ]}
                            />
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Text style={styles.assScore}>{item.percentage}</Text>
                          {hasDetails && (
                            <Ionicons
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={16}
                              color={theme.subtext}
                            />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.detailsContainer}>
                          {item.details.map((detail: any, dIdx: number) => {
                            const isLowScore = isBelowAverage(
                              detail.obtainedMarks,
                              detail.classAverage,
                            );
                            return (
                              <View key={dIdx} style={styles.detailRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.detailName}>
                                    {detail.name}
                                  </Text>
                                  <Text style={styles.detailMeta}>
                                    Avg: {detail.classAverage} • Max:{" "}
                                    {detail.maxMarks}
                                  </Text>
                                </View>
                                <View style={{ alignItems: "flex-end" }}>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    {isLowScore && (
                                      <Ionicons
                                        name="alert-circle"
                                        size={12}
                                        color="#EF4444"
                                      />
                                    )}
                                    <Text
                                      style={[
                                        styles.detailScore,
                                        isLowScore && { color: "#EF4444" },
                                      ]}
                                    >
                                      {detail.obtainedMarks}
                                    </Text>
                                  </View>
                                  <Text style={styles.detailPerc}>
                                    {detail.percentage}%
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderHistory = () => {
    const progressPerc = historyStatsObj
      ? Math.min(
          (historyStatsObj.totalCredits / DEGREE_TOTAL_CREDITS) * 100,
          100,
        )
      : 0;

    return (
      <View style={styles.tabContentWrapper}>
        {historyStatsObj && (
          <View style={styles.bentoRow}>
            <View style={[styles.bentoBox, styles.bentoHalf]}>
              <Ionicons
                name="star"
                size={24}
                color="#10B981"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.bentoLabel}>BEST TERM</Text>
              <Text style={[styles.bentoValueSm, { color: "#10B981" }]}>
                {historyStatsObj.best.sgpa} GPA
              </Text>
              <Text style={styles.bentoMicro}>{historyStatsObj.best.term}</Text>
            </View>
            <View style={[styles.bentoBox, styles.bentoHalf]}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Ionicons name="book" size={24} color="#F59E0B" />
                <Text style={styles.bentoMicro}>
                  {Math.round(progressPerc)}%
                </Text>
              </View>
              <Text style={styles.bentoLabel}>TOTAL EARNED</Text>
              <Text style={[styles.bentoValueSm, { color: theme.text }]}>
                {historyStatsObj.totalCredits} Cr
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPerc}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color={theme.border} />
            <Text style={styles.emptyText}>No history records.</Text>
          </View>
        ) : (
          history.map((sem: any, idx: number) => {
            const sgpa = parseFloat(sem.sgpa) || 0;

            const isBest =
              historyStatsObj && sgpa === historyStatsObj.best.sgpa && sgpa > 0;

            const isExpanded = expandedHistory[idx];

            return (
              <View key={idx} style={styles.acadCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleHistoryRow(idx)}
                  style={styles.historyHeader}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text style={styles.historyTermName}>{sem.term}</Text>
                      {isBest && (
                        <View style={styles.microBadge}>
                          <Text style={styles.microBadgeText}>BEST</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.historyMeta}>
                      {sem.courses?.length || 0} Courses • {sem.earnedCH} Cr
                    </Text>
                  </View>
                  <View style={styles.historyScores}>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.bentoLabel}>SGPA</Text>
                      <Text
                        style={[
                          styles.scoreValue,
                          sgpa >= 3.5 && { color: "#10B981" },
                        ]}
                      >
                        {sem.sgpa}
                      </Text>
                    </View>
                    <View style={styles.dividerVert} />
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.bentoLabel}>CGPA</Text>
                      <Text style={[styles.scoreValue, { color: "#3B82F6" }]}>
                        {sem.cgpa}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.subtext}
                    style={{ marginLeft: 10 }}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.historyBody}>
                    {sem.courses?.map((course: any, cIdx: number) => (
                      <View key={cIdx} style={styles.historyCourseRow}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.detailName} numberOfLines={2}>
                            {course.name}
                          </Text>
                          <Text style={styles.detailMeta}>
                            {course.creditHours} Cr • {course.gradePoints} Pts
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.gradePill,
                            {
                              backgroundColor: `${getGradeColor(
                                course.finalGrade,
                              )}15`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyGrade,
                              { color: getGradeColor(course.finalGrade) },
                            ]}
                          >
                            {course.finalGrade}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      {/* --- SMART INVERTING HORIZONTAL TAB BAR --- */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topTabContainer}
        >
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            // Logic: If active, use inverted text color (White in dark mode, Black in light mode).
            // If inactive, use the subtext color (Gray).
            const iconColor = isActive ? theme.invertedText : theme.subtext;

            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                style={[styles.topTab, isActive && styles.activeTopTab]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    isActive
                      ? (tab.icon as any)
                      : (`${tab.icon}-outline` as any)
                  }
                  size={16}
                  color={iconColor}
                />
                <Text
                  style={[
                    styles.topTabText,
                    isActive && styles.activeTopTabText,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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
          {activeTab === "courses" && renderCourses()}
          {activeTab === "timetable" && renderTimetable()}
          {activeTab === "grades" && renderGradeBook()}
          {activeTab === "history" && renderHistory()}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    // Tab Bar Styles
    topTabContainer: {
      paddingHorizontal: 24,
      paddingBottom: 20,
      paddingTop: 10,
      gap: 10,
      flexDirection: "row",
    },
    topTab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeTopTab: {
      backgroundColor: theme.invertedBg,
      borderColor: theme.invertedBg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    topTabText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 0.5,
    },
    activeTopTabText: { color: theme.invertedText },

    scrollContent: { paddingBottom: 100 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: 24,
    },
    emptyText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "600",
      marginTop: 15,
    },

    tabContentWrapper: { paddingHorizontal: 24, gap: 16 },

    // --- ACADEMIC BENTO STATS ---
    bentoRow: { gap: 12, marginBottom: 10 },
    bentoRowInner: { flexDirection: "row", gap: 12 },
    bentoBox: {
      padding: 20,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: "hidden",
    },
    bentoFull: { alignItems: "flex-start", paddingVertical: 24 },
    bentoHalf: { flex: 1 },
    bentoLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
    },
    bentoValueLg: {
      fontSize: 36,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 4,
    },
    bentoValueSm: {
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.5,
      marginTop: 2,
    },
    bentoMicro: {
      fontSize: 11,
      color: theme.subtext,
      fontWeight: "600",
      marginTop: 4,
    },

    progressBarBg: {
      height: 6,
      backgroundColor: theme.background,
      borderRadius: 3,
      marginTop: 10,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: "#F59E0B",
      borderRadius: 3,
    },

    // --- ACADEMIC CARDS (GRADES & HISTORY) ---
    acadCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
      overflow: "hidden",
    },
    acadHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    scoreBadge: {
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    scoreBadgeText: { color: "#3B82F6", fontWeight: "800", fontSize: 14 },
    acadBody: { paddingVertical: 8 },

    assessmentRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    assName: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.2,
    },
    assWeight: {
      fontSize: 11,
      color: theme.subtext,
      fontWeight: "700",
      marginTop: 2,
    },
    assScore: { fontSize: 18, fontWeight: "900", color: theme.text },

    miniBarBg: {
      height: 4,
      backgroundColor: theme.background,
      borderRadius: 2,
      marginTop: 8,
      overflow: "hidden",
    },
    miniBarFill: { height: "100%", borderRadius: 2 },

    detailsContainer: {
      backgroundColor: theme.background,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    detailName: { fontSize: 13, fontWeight: "700", color: theme.text },
    detailMeta: {
      fontSize: 11,
      color: theme.subtext,
      fontWeight: "500",
      marginTop: 2,
    },
    detailScore: { fontSize: 13, fontWeight: "800", color: theme.text },
    detailPerc: {
      fontSize: 11,
      color: theme.subtext,
      textAlign: "right",
      marginTop: 2,
      fontWeight: "700",
    },

    // --- HISTORY SPECIFIC ---
    historyHeader: { flexDirection: "row", alignItems: "center", padding: 20 },
    historyTermName: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
    },
    historyMeta: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: "600",
      marginTop: 4,
    },
    historyScores: { flexDirection: "row", alignItems: "center", gap: 12 },
    dividerVert: { width: 1, height: 30, backgroundColor: theme.border },
    scoreValue: { fontSize: 18, fontWeight: "900", color: theme.text },
    microBadge: {
      backgroundColor: "rgba(16, 185, 129, 0.1)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: "rgba(16, 185, 129, 0.2)",
    },
    microBadgeText: { fontSize: 8, fontWeight: "900", color: "#10B981" },

    historyBody: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
      paddingVertical: 8,
    },
    historyCourseRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    gradePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    historyGrade: { fontSize: 16, fontWeight: "900" },

    // --- TIMETABLE / COURSES SHARED (Preserved) ---
    daySelectorContainer: { paddingHorizontal: 24, gap: 10, paddingBottom: 25 },
    dayPill: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeDayPill: {
      backgroundColor: theme.invertedBg,
      borderColor: theme.invertedBg,
    },
    dayPillText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: 1,
    },
    activeDayPillText: { color: theme.invertedText },
    timetableWrapper: { flex: 1 },
    timelineContainer: { paddingHorizontal: 24 },
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
    sessionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    ucpIcon: { marginRight: 8 },
    sessionName: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      flex: 1,
    },
    sessionFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sessionDetail: { flexDirection: "row", alignItems: "center", gap: 6 },
    sessionDetailText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.subtext,
    },
    roomBadge: {
      backgroundColor: theme.background,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    roomText: { color: theme.text, fontSize: 11, fontWeight: "800" },
    gridContainer: { paddingHorizontal: 24, gap: 16 },
    sectionGroup: { marginBottom: 10 },
    sectionHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 15,
      marginLeft: 5,
    },
    courseCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    courseHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
      gap: 12,
    },
    titleWrapper: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 10,
    },
    courseName: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      flexShrink: 1,
    },
    courseCode: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      overflow: "hidden",
      marginTop: 2,
    },
    metaRow: { flexDirection: "column", gap: 10, marginBottom: 20 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    metaText: {
      fontSize: 13,
      color: theme.subtext,
      fontWeight: "600",
      flexShrink: 1,
    },
    courseFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 16,
    },
    syncedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    syncedText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 0.5,
    },
  });
