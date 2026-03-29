import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

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
    emerald: "#10B981",
    emeraldBg: "#D1FAE5",
    rose: "#F43F5E",
    roseBg: "#FFE4E6",
    indigo: "#6366F1",
    indigoBg: "#E0E7FF",
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
    emerald: "#34D399",
    emeraldBg: "rgba(16, 185, 129, 0.15)",
    rose: "#FB7185",
    roseBg: "rgba(244, 63, 94, 0.15)",
    indigo: "#818CF8",
    indigoBg: "rgba(99, 102, 241, 0.15)",
    amber: "#FBBF24",
    amberBg: "rgba(245, 158, 11, 0.15)",
    blue: "#60A5FA",
    blueBg: "rgba(59, 130, 246, 0.15)",
  },
};

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DEGREE_TOTAL_CREDITS = 133;

const SUB_TABS = [
  { id: "courses", label: "Courses", icon: "library" },
  { id: "timetable", label: "Timetable", icon: "calendar" },
  { id: "attendance", label: "Attendance", icon: "checkmark-done" },
  { id: "submissions", label: "Submissions", icon: "document-text" },
  { id: "announcements", label: "Announcements", icon: "megaphone" },
  { id: "grades", label: "Grades", icon: "school" },
  { id: "history", label: "History", icon: "time" },
] as const;

const isBelowAverage = (obtained: string, average: string) => {
  const obt = parseFloat(obtained);
  const avg = parseFloat(average);
  if (isNaN(obt) || isNaN(avg)) return false;
  return obt < avg;
};

const getGradeColor = (grade: string) => {
  const dangerGrades = ["C-", "D+", "D", "F", "W"];
  if (dangerGrades.includes(grade)) return "#EF4444";
  return "#3B82F6";
};

const DualCircularProgress = ({
  percentage,
  theme,
}: {
  percentage: number;
  theme: any;
}) => {
  const radius = 45;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        <Circle
          cx="60"
          cy="60"
          r={radius}
          stroke={theme.rose}
          strokeWidth={strokeWidth}
          fill="none"
          strokeOpacity={0.8}
        />
        <Circle
          cx="60"
          cy="60"
          r={radius}
          stroke={theme.emerald}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "900", color: theme.text }}>
          {percentage.toFixed(0)}%
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "800",
            color: theme.subtext,
            textTransform: "uppercase",
          }}
        >
          Attended
        </Text>
      </View>
    </View>
  );
};

export default function ClassesScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [activeTab, setActiveTab] = useState<
    | "courses"
    | "timetable"
    | "attendance"
    | "submissions"
    | "announcements"
    | "grades"
    | "history"
  >("courses");
  const [selectedDay, setSelectedDay] = useState("Monday");

  const [courses, setCourses] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [submissionsData, setSubmissionsData] = useState<any[]>([]);
  const [announcementsData, setAnnouncementsData] = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<any>({
    cgpa: "0.00",
    credits: "0",
    inprogressCr: "0",
  });

  const [hiddenCourses, setHiddenCourses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGrades, setExpandedGrades] = useState<{
    [key: string]: boolean;
  }>({});
  const [expandedHistory, setExpandedHistory] = useState<{
    [key: string]: boolean;
  }>({});
  const [expandedCourseAccordion, setExpandedCourseAccordion] = useState<
    string | null
  >(null);

  const fetchData = async () => {
    try {
      const [cCourses, cTime, cGrades, cHist, cStats, cAtt, cSub, cAnn, cHidd] =
        await Promise.all([
          AsyncStorage.getItem("off_acad_courses"),
          AsyncStorage.getItem("off_acad_time"),
          AsyncStorage.getItem("off_acad_grades"),
          AsyncStorage.getItem("off_acad_history"),
          AsyncStorage.getItem("off_acad_stats"),
          AsyncStorage.getItem("off_acad_att"),
          AsyncStorage.getItem("off_acad_sub"),
          AsyncStorage.getItem("off_acad_ann"),
          AsyncStorage.getItem("hiddenCourses"),
        ]);

      if (cHidd) setHiddenCourses(JSON.parse(cHidd));
      if (cCourses) setCourses(JSON.parse(cCourses));
      if (cTime) setTimetable(JSON.parse(cTime));
      if (cGrades) setGrades(JSON.parse(cGrades));
      if (cHist) setHistory(JSON.parse(cHist));
      if (cStats) setStudentStats(JSON.parse(cStats));
      if (cAtt) setAttendanceData(JSON.parse(cAtt));
      if (cSub) setSubmissionsData(JSON.parse(cSub));
      if (cAnn) setAnnouncementsData(JSON.parse(cAnn));

      if (cCourses || cHist) setIsLoading(false);

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
        axios.get(`${BACKEND_URL}/attendance`, config),
        axios.get(`${BACKEND_URL}/submissions`, config),
        axios.get(`${BACKEND_URL}/announcements`, config),
      ]);

      if (results[0].status === "fulfilled") {
        setCourses(results[0].value.data || []);
        AsyncStorage.setItem(
          "off_acad_courses",
          JSON.stringify(results[0].value.data || []),
        );
      }
      if (results[1].status === "fulfilled") {
        setTimetable(results[1].value.data || []);
        AsyncStorage.setItem(
          "off_acad_time",
          JSON.stringify(results[1].value.data || []),
        );
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
      if (results[5].status === "fulfilled") {
        setAttendanceData(results[5].value.data || []);
        AsyncStorage.setItem(
          "off_acad_att",
          JSON.stringify(results[5].value.data || []),
        );
      }
      if (results[6].status === "fulfilled") {
        setSubmissionsData(results[6].value.data || []);
        AsyncStorage.setItem(
          "off_acad_sub",
          JSON.stringify(results[6].value.data || []),
        );
      }
      if (results[7].status === "fulfilled") {
        setAnnouncementsData(results[7].value.data || []);
        AsyncStorage.setItem(
          "off_acad_ann",
          JSON.stringify(results[7].value.data || []),
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

  const toggleCourseAccordion = (courseName: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCourseAccordion(
      expandedCourseAccordion === courseName ? null : courseName,
    );
  };

  // --- RENDERERS ---

  const renderCourses = () => {
    // 🔥 ACTIVE FILTERING: Exclude hidden courses
    const uniCourses = courses.filter(
      (c: any) =>
        (c.type === "university" || c.type === "uni") &&
        !hiddenCourses.includes(c.name),
    );

    if (uniCourses.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={48} color={theme.border} />
          <Text style={styles.emptyText}>No visible courses found.</Text>
        </View>
      );
    }

    return (
      <View style={styles.gridContainer}>
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeading}>Synced University Courses</Text>
          {uniCourses.map((course: any, index: number) => {
            const instructorNames =
              Array.isArray(course.instructors) && course.instructors.length > 0
                ? course.instructors.join(" • ")
                : "Instructor TBD";
            const roomNames =
              Array.isArray(course.rooms) && course.rooms.length > 0
                ? course.rooms.join(", ")
                : "Room TBD";

            const courseSubs =
              submissionsData.find((s: any) => s.courseName === course.name)
                ?.tasks || [];
            const totalSubs = courseSubs.length;
            const activeSubs = courseSubs.filter(
              (t: any) =>
                !t.status.toLowerCase().includes("submitted") &&
                new Date(t.dueDate) > new Date(),
            ).length;

            return (
              <View
                key={course._id || `uni-${index}`}
                style={styles.courseCard}
              >
                <View style={styles.courseHeader}>
                  <View style={styles.titleWrapper}>
                    <UCPLogo width={24} height={24} color={theme.text} />
                    <Text style={styles.courseName}>{course.name}</Text>
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
                  <View style={styles.courseStatsGroup}>
                    <View style={styles.statBadge}>
                      <Text style={styles.statBadgeText}>
                        Tasks: {totalSubs}
                      </Text>
                    </View>
                    {activeSubs > 0 && (
                      <View
                        style={[
                          styles.statBadge,
                          {
                            backgroundColor: theme.roseBg,
                            borderColor: theme.rose,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.statBadgeText, { color: theme.rose }]}
                        >
                          {activeSubs} Active
                        </Text>
                      </View>
                    )}
                  </View>
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
      </View>
    );
  };

  const renderTimetable = () => {
    // 🔥 ACTIVE FILTERING: Exclude hidden courses
    const dayClasses = timetable.filter(
      (session: any) =>
        session.day &&
        session.day.toLowerCase() === selectedDay.toLowerCase() &&
        !hiddenCourses.includes(session.courseName),
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
              <Text style={styles.emptyText}>
                No visible classes scheduled.
              </Text>
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
                    <Text style={styles.sessionName}>
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
    // 🔥 ACTIVE FILTERING: Exclude hidden courses
    const visibleGrades = grades.filter(
      (course: any) => !hiddenCourses.includes(course.courseName),
    );

    return (
      <View style={styles.tabContentWrapper}>
        <View style={styles.bentoRow}>
          <View
            style={[
              styles.bentoBox,
              styles.bentoFull,
              { backgroundColor: theme.blue, borderColor: theme.blue },
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
              <Text style={[styles.bentoValueSm, { color: theme.emerald }]}>
                {studentStats.inprogressCr || "0"} Cr
              </Text>
            </View>
            <View style={[styles.bentoBox, styles.bentoHalf]}>
              <Text style={styles.bentoLabel}>COMPLETED</Text>
              <Text style={[styles.bentoValueSm, { color: theme.amber }]}>
                {studentStats.credits || "0"} Cr
              </Text>
            </View>
          </View>
        </View>

        {visibleGrades.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={48}
              color={theme.border}
            />
            <Text style={styles.emptyText}>No visible grades synced.</Text>
          </View>
        ) : (
          visibleGrades.map((course: any) => (
            <View key={course._id} style={styles.gradeCourseCard}>
              <View style={styles.gradeCourseHeader}>
                <View style={styles.gradeCourseTitleWrapper}>
                  <UCPLogo width={26} height={26} color={theme.text} />
                  <Text style={styles.gradeCourseName}>
                    {course.courseName}
                  </Text>
                </View>
                {course.totalPercentage && course.totalPercentage !== "0" && (
                  <View style={styles.gradeTotalBadge}>
                    <Text style={styles.gradeTotalBadgeText}>
                      {course.totalPercentage}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.gradeAssessmentsList}>
                {course.assessments.map((item: any, idx: number) => {
                  const isExpanded = expandedGrades[`${course._id}-${idx}`];
                  const hasDetails = item.details && item.details.length > 0;
                  const percValue = parseFloat(item.percentage) || 0;

                  return (
                    <View key={idx} style={styles.gradeAssItem}>
                      <TouchableOpacity
                        activeOpacity={hasDetails ? 0.6 : 1}
                        onPress={() =>
                          hasDetails && toggleGradeRow(course._id, idx)
                        }
                      >
                        <View style={styles.gradeAssRowHeader}>
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={styles.gradeAssName}>{item.name}</Text>
                            {item.weight && (
                              <Text style={styles.gradeAssWeight}>
                                Weight: {item.weight}
                              </Text>
                            )}
                          </View>
                          <View style={styles.gradeAssScoreContainer}>
                            <Text style={styles.gradeAssScoreText}>
                              {item.percentage}
                            </Text>
                            {hasDetails && (
                              <Ionicons
                                name={
                                  isExpanded ? "chevron-up" : "chevron-down"
                                }
                                size={18}
                                color={theme.subtext}
                              />
                            )}
                          </View>
                        </View>
                        <View style={styles.gradeAssProgressTrack}>
                          <View
                            style={[
                              styles.gradeAssProgressFill,
                              {
                                width: `${Math.min(percValue, 100)}%`,
                                backgroundColor:
                                  percValue >= 80
                                    ? theme.emerald
                                    : percValue >= 60
                                      ? theme.amber
                                      : theme.rose,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>

                      {isExpanded && hasDetails && (
                        <View style={styles.gradeDetailsWrapper}>
                          {item.details.map((detail: any, dIdx: number) => {
                            const isLowScore = isBelowAverage(
                              detail.obtainedMarks,
                              detail.classAverage,
                            );
                            return (
                              <View key={dIdx} style={styles.gradeDetailItem}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                  <Text style={styles.gradeDetailName}>
                                    {detail.name}
                                  </Text>
                                  <Text style={styles.gradeDetailMeta}>
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
                                        size={14}
                                        color={theme.rose}
                                      />
                                    )}
                                    <Text
                                      style={[
                                        styles.gradeDetailScore,
                                        isLowScore && { color: theme.rose },
                                      ]}
                                    >
                                      {detail.obtainedMarks}
                                    </Text>
                                  </View>
                                  <Text style={styles.gradeDetailPerc}>
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
                color={theme.emerald}
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.bentoLabel}>BEST TERM</Text>
              <Text style={[styles.bentoValueSm, { color: theme.emerald }]}>
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
                <Ionicons name="book" size={24} color={theme.amber} />
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
                          sgpa >= 3.5 && { color: theme.emerald },
                        ]}
                      >
                        {sem.sgpa}
                      </Text>
                    </View>
                    <View style={styles.dividerVert} />
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.bentoLabel}>CGPA</Text>
                      <Text style={[styles.scoreValue, { color: theme.blue }]}>
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
                          <Text style={styles.detailName}>{course.name}</Text>
                          <Text style={styles.detailMeta}>
                            {course.creditHours} Cr • {course.gradePoints} Pts
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.gradePill,
                            {
                              backgroundColor: `${getGradeColor(course.finalGrade)}15`,
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

  const renderAccordionSection = (
    tabType: "attendance" | "submissions" | "announcements",
  ) => {
    // 🔥 ACTIVE FILTERING: Exclude hidden courses
    const uniCourses = courses.filter(
      (c: any) =>
        (c.type === "university" || c.type === "uni") &&
        !hiddenCourses.includes(c.name),
    );

    if (uniCourses.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={48} color={theme.border} />
          <Text style={styles.emptyText}>No visible synced courses.</Text>
        </View>
      );
    }

    return (
      <View style={styles.gridContainer}>
        {uniCourses.map((course: any) => {
          const isExpanded = expandedCourseAccordion === course.name;

          let previewElement: React.ReactNode = (
            <Text style={styles.coursePreviewText}>No data yet</Text>
          );
          let contentToRender = null;

          if (tabType === "attendance") {
            const att = attendanceData.find(
              (a) => a.courseName === course.name,
            );
            if (att?.summary) {
              const conducted = att.summary.conducted;
              const attended = att.summary.attended;
              const absent = conducted - attended;
              const p = conducted > 0 ? (attended / conducted) * 100 : 0;
              previewElement = (
                <Text style={styles.coursePreviewText}>
                  {p.toFixed(0)}% Attended
                </Text>
              );

              let statusText = "Good Standing";
              let statusColor = theme.emerald;
              if (p < 75) {
                statusText = "Warning";
                statusColor = theme.amber;
              }
              if (p < 60) {
                statusText = "Critical";
                statusColor = theme.rose;
              }

              contentToRender = (
                <View style={styles.accordionBody}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <Text style={styles.sectionHeading}>
                      Attendance Overview
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: statusColor + "15",
                          borderColor: statusColor,
                        },
                      ]}
                    >
                      <Ionicons name="pulse" size={12} color={statusColor} />
                      <Text
                        style={[styles.statusPillText, { color: statusColor }]}
                      >
                        {statusText}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.attSummaryRow}>
                    <DualCircularProgress percentage={p} theme={theme} />
                    <View style={styles.attStatsBox}>
                      <View
                        style={[
                          styles.attStatBox,
                          {
                            borderColor: theme.emerald,
                            backgroundColor: theme.emeraldBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.attStatValue,
                            { color: theme.emerald },
                          ]}
                        >
                          {attended}
                        </Text>
                        <Text
                          style={[
                            styles.attStatLabel,
                            { color: theme.emerald },
                          ]}
                        >
                          Present
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View
                          style={[
                            styles.attStatBox,
                            {
                              flex: 1,
                              borderColor: theme.rose,
                              backgroundColor: theme.roseBg,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.attStatValue, { color: theme.rose }]}
                          >
                            {absent}
                          </Text>
                          <Text
                            style={[styles.attStatLabel, { color: theme.rose }]}
                          >
                            Absent
                          </Text>
                        </View>
                        <View style={[styles.attStatBox, { flex: 1 }]}>
                          <Text style={styles.attStatValue}>{conducted}</Text>
                          <Text style={styles.attStatLabel}>Total</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.sectionHeading}>Recent Logs</Text>
                  <View style={styles.recordsGrid}>
                    {att.records.map((rec: any, idx: number) => {
                      const isPresent = rec.status.toLowerCase() === "present";
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.recordPill,
                            isPresent
                              ? styles.recordPillPresent
                              : styles.recordPillAbsent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.recordDate,
                              isPresent
                                ? { color: theme.emerald }
                                : { color: theme.rose },
                            ]}
                          >
                            {rec.date}
                          </Text>
                          <Text
                            style={[
                              styles.recordStatus,
                              isPresent
                                ? { color: theme.emerald }
                                : { color: theme.rose },
                            ]}
                          >
                            {isPresent ? "Present" : "Absent"}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            }
          } else if (tabType === "submissions") {
            const sub = submissionsData.find(
              (s) => s.courseName === course.name,
            );
            if (sub?.tasks) {
              const activeCount = sub.tasks.filter(
                (t: any) =>
                  !t.status.includes("Submitted") &&
                  new Date(t.dueDate) > new Date(),
              ).length;
              previewElement = (
                <Text style={styles.coursePreviewText}>
                  {sub.tasks.length} Total •{" "}
                  <Text
                    style={{
                      color: activeCount > 0 ? theme.rose : theme.subtext,
                    }}
                  >
                    {activeCount} Active
                  </Text>
                </Text>
              );

              contentToRender = (
                <View style={styles.accordionBody}>
                  {sub.tasks.length === 0 ? (
                    <Text style={styles.emptyAccordionText}>
                      No active submissions.
                    </Text>
                  ) : (
                    sub.tasks.map((task: any, idx: number) => {
                      const isSubmitted = task.status
                        .toLowerCase()
                        .includes("submitted");
                      const due = new Date(task.dueDate);
                      const now = new Date();
                      const diffDays = Math.ceil(
                        (due.getTime() - now.getTime()) / (1000 * 3600 * 24),
                      );
                      const isExpired = !isSubmitted && diffDays < 0;

                      let cardBorder = theme.border;
                      let timeBadgeColor = theme.subtext;
                      let timeText = `Due: ${task.dueDate}`;

                      if (isSubmitted) {
                        cardBorder = theme.emerald;
                        timeText = "Completed";
                        timeBadgeColor = theme.emerald;
                      } else if (isExpired) {
                        cardBorder = theme.rose;
                        timeText = "Expired";
                        timeBadgeColor = theme.rose;
                      } else {
                        cardBorder = theme.blue;
                        timeText = `${diffDays} days left`;
                        timeBadgeColor =
                          diffDays <= 2 ? theme.amber : theme.blue;
                      }

                      return (
                        <View
                          key={idx}
                          style={[
                            styles.taskCard,
                            { borderLeftColor: cardBorder, borderLeftWidth: 4 },
                          ]}
                        >
                          <View style={styles.taskHeader}>
                            <Text style={styles.taskTitle}>{task.title}</Text>
                            <View
                              style={[
                                styles.timeBadge,
                                { backgroundColor: timeBadgeColor + "15" },
                              ]}
                            >
                              <Ionicons
                                name={
                                  isSubmitted
                                    ? "checkmark-circle"
                                    : "hourglass-outline"
                                }
                                size={12}
                                color={timeBadgeColor}
                              />
                              <Text
                                style={[
                                  styles.timeBadgeText,
                                  { color: timeBadgeColor },
                                ]}
                              >
                                {timeText}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.taskDesc}>
                            {task.description}
                          </Text>
                          <View
                            style={[
                              styles.taskFooter,
                              {
                                justifyContent: task.attachmentUrl
                                  ? "space-between"
                                  : "flex-end",
                              },
                            ]}
                          >
                            {task.attachmentUrl && (
                              <TouchableOpacity
                                style={styles.attachmentBtn}
                                onPress={() =>
                                  Linking.openURL(task.attachmentUrl)
                                }
                              >
                                <Ionicons
                                  name="document-attach-outline"
                                  size={16}
                                  color={theme.blue}
                                />
                                <Text style={styles.attachmentBtnText}>
                                  View File
                                </Text>
                              </TouchableOpacity>
                            )}
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              {isSubmitted ? (
                                <View style={styles.statusPillDone}>
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={14}
                                    color={theme.emerald}
                                  />
                                  <Text
                                    style={[
                                      styles.statusText,
                                      { color: theme.emerald },
                                    ]}
                                  >
                                    Submitted on Portal
                                  </Text>
                                </View>
                              ) : isExpired ? (
                                <View
                                  style={[
                                    styles.statusPillDone,
                                    { backgroundColor: theme.roseBg },
                                  ]}
                                >
                                  <Ionicons
                                    name="close-circle"
                                    size={14}
                                    color={theme.rose}
                                  />
                                  <Text
                                    style={[
                                      styles.statusText,
                                      { color: theme.rose },
                                    ]}
                                  >
                                    Missed Deadline
                                  </Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[
                                    styles.submitBtn,
                                    { backgroundColor: theme.blue },
                                  ]}
                                  onPress={() =>
                                    task.submissionUrl &&
                                    Linking.openURL(task.submissionUrl)
                                  }
                                >
                                  <Ionicons
                                    name="cloud-upload"
                                    size={14}
                                    color="#FFF"
                                  />
                                  <Text style={styles.submitBtnText}>
                                    Submit Work
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            }
          } else if (tabType === "announcements") {
            const ann = announcementsData.find(
              (a) => a.courseName === course.name,
            );
            if (ann?.news) {
              previewElement = (
                <Text style={styles.coursePreviewText}>
                  {ann.news.length} Announcements
                </Text>
              );

              contentToRender = (
                <View style={styles.accordionBody}>
                  {ann.news.length === 0 ? (
                    <Text style={styles.emptyAccordionText}>
                      No announcements found.
                    </Text>
                  ) : (
                    ann.news.map((news: any, idx: number) => {
                      const isNewest = idx === 0;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.annCard,
                            isNewest && {
                              backgroundColor: theme.indigoBg,
                              borderColor: theme.indigo,
                            },
                          ]}
                        >
                          <View style={styles.annHeader}>
                            <View
                              style={[
                                styles.annIconBox,
                                isNewest && { backgroundColor: theme.indigo },
                              ]}
                            >
                              <Ionicons
                                name="megaphone"
                                size={16}
                                color={isNewest ? "#FFF" : theme.subtext}
                              />
                            </View>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                              <Text
                                style={[
                                  styles.annSubject,
                                  isNewest && { color: theme.indigo },
                                ]}
                              >
                                {news.subject}
                              </Text>
                            </View>
                            <View style={styles.annDatePill}>
                              <Text style={styles.annDateText}>
                                {news.date}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.annDesc,
                              isNewest && { color: theme.text },
                            ]}
                            selectable
                          >
                            {news.description}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            }
          }

          return (
            <View key={course.name} style={styles.accordionTile}>
              <TouchableOpacity
                style={styles.accordionHeader}
                activeOpacity={0.7}
                onPress={() => toggleCourseAccordion(course.name)}
              >
                <View style={styles.accordionHeaderLeft}>
                  <UCPLogo width={36} height={36} color={theme.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseNameText}>{course.name}</Text>
                    {previewElement}
                  </View>
                </View>
                <View
                  style={[
                    styles.accordionChevron,
                    isExpanded && { backgroundColor: theme.text },
                  ]}
                >
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={isExpanded ? theme.background : theme.subtext}
                  />
                </View>
              </TouchableOpacity>
              {isExpanded &&
                (contentToRender || (
                  <Text style={styles.emptyAccordionText}>
                    No data available for this course yet.
                  </Text>
                ))}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topTabContainer}
        >
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const iconColor = isActive ? theme.invertedText : theme.subtext;

            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id as any);
                  setExpandedCourseAccordion(null);
                }}
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
          {activeTab === "attendance" && renderAccordionSection("attendance")}
          {activeTab === "submissions" && renderAccordionSection("submissions")}
          {activeTab === "announcements" &&
            renderAccordionSection("announcements")}
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

    gradeCourseCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      paddingBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    gradeCourseHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    gradeCourseTitleWrapper: {
      flexDirection: "row",
      alignItems: "flex-start",
      flex: 1,
      gap: 12,
    },
    gradeCourseName: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      flex: 1,
      flexWrap: "wrap",
    },
    gradeTotalBadge: {
      backgroundColor: theme.text,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      marginLeft: 10,
    },
    gradeTotalBadgeText: {
      color: theme.background,
      fontWeight: "900",
      fontSize: 14,
    },
    gradeAssessmentsList: { flexDirection: "column" },
    gradeAssItem: { marginBottom: 16 },
    gradeAssRowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    gradeAssName: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.2,
    },
    gradeAssWeight: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: "600",
      marginTop: 2,
    },
    gradeAssScoreContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    gradeAssScoreText: { fontSize: 17, fontWeight: "900", color: theme.text },
    gradeAssProgressTrack: {
      height: 6,
      backgroundColor: theme.background,
      borderRadius: 3,
      overflow: "hidden",
    },
    gradeAssProgressFill: { height: "100%", borderRadius: 3 },
    gradeDetailsWrapper: {
      marginTop: 12,
      paddingLeft: 16,
      borderLeftWidth: 2,
      borderLeftColor: theme.border,
      gap: 12,
    },
    gradeDetailItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    gradeDetailName: { fontSize: 13, fontWeight: "700", color: theme.text },
    gradeDetailMeta: {
      fontSize: 11,
      color: theme.subtext,
      fontWeight: "600",
      marginTop: 2,
    },
    gradeDetailScore: { fontSize: 13, fontWeight: "800", color: theme.text },
    gradeDetailPerc: {
      fontSize: 11,
      color: theme.subtext,
      textAlign: "right",
      marginTop: 2,
      fontWeight: "700",
    },

    acadCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
      overflow: "hidden",
    },
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
    detailName: { fontSize: 13, fontWeight: "700", color: theme.text },
    detailMeta: {
      fontSize: 11,
      color: theme.subtext,
      fontWeight: "500",
      marginTop: 2,
    },
    gradePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    historyGrade: { fontSize: 16, fontWeight: "900" },

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
      fontWeight: "900",
      color: theme.subtext,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 15,
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
    courseStatsGroup: { flexDirection: "row", gap: 8 },
    statBadge: {
      backgroundColor: theme.card,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statBadgeText: { fontSize: 10, fontWeight: "800", color: theme.subtext },
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

    accordionTile: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 24,
      overflow: "hidden",
    },
    accordionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
    },
    accordionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      flex: 1,
      paddingRight: 10,
    },
    courseIconBoxMini: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    courseNameText: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
    },
    coursePreviewText: {
      fontSize: 13,
      color: theme.subtext,
      fontWeight: "600",
      marginTop: 2,
    },
    accordionChevron: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    accordionBody: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 20,
    },
    emptyAccordionText: {
      padding: 20,
      textAlign: "center",
      color: theme.subtext,
      fontSize: 14,
      fontWeight: "600",
      fontStyle: "italic",
    },

    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    attSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 24,
      marginBottom: 30,
    },
    attStatsBox: { flex: 1, gap: 10 },
    attStatBox: {
      backgroundColor: theme.background,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    attStatValue: { fontSize: 24, fontWeight: "900", color: theme.text },
    attStatLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      textTransform: "uppercase",
      marginTop: 2,
    },
    recordsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    recordPill: {
      width: "31%",
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      backgroundColor: theme.background,
    },
    recordPillPresent: { borderColor: theme.emeraldBg },
    recordPillAbsent: { borderColor: theme.roseBg },
    recordDate: { fontSize: 12, fontWeight: "900", marginBottom: 2 },
    recordStatus: {
      fontSize: 9,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    taskCard: {
      backgroundColor: theme.background,
      borderRightWidth: 1,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    taskHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    taskTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.text,
      flex: 1,
      marginRight: 12,
      lineHeight: 22,
    },
    timeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    timeBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    taskDesc: {
      fontSize: 14,
      color: theme.subtext,
      lineHeight: 20,
      marginBottom: 16,
    },
    taskFooter: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 16,
    },
    attachmentBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.blueBg,
      borderRadius: 8,
    },
    attachmentBtnText: { color: theme.blue, fontSize: 12, fontWeight: "700" },
    statusPillDone: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.emeraldBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    statusText: { fontSize: 12, fontWeight: "800" },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    submitBtnText: { color: "#FFF", fontSize: 13, fontWeight: "800" },

    annCard: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
    },
    annHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    annIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    annSubject: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.text,
      lineHeight: 22,
    },
    annDatePill: {
      backgroundColor: theme.card,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    annDateText: { fontSize: 10, fontWeight: "800", color: theme.subtext },
    annDesc: { fontSize: 14, color: theme.subtext, lineHeight: 22 },
  });
