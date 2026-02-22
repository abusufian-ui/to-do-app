import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useState } from "react";
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
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// IMPORT YOUR CUSTOM UCP LOGO
import UCPLogo from "../../components/UCPLogo";

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

export default function ClassesScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [activeTab, setActiveTab] = useState<"courses" | "timetable">(
    "courses",
  );
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [courses, setCourses] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!BACKEND_URL) return;

      const token = await AsyncStorage.getItem("userToken");
      const config = { headers: { "x-auth-token": token } };

      const [coursesRes, timetableRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/courses`, config),
        axios.get(`${BACKEND_URL}/timetable`, config),
      ]);

      setCourses(coursesRes.data || []);
      setTimetable(timetableRes.data || []);
    } catch (error) {
      console.error("Fetch Error:", error);
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

  // --- RENDER: MY COURSES ---
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
          <Text style={styles.emptySubtext}>
            Sync via extension or add a personal course.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.gridContainer}>
        {/* --- UNIVERSITY COURSES SECTION --- */}
        {uniCourses.length > 0 && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeading}>Synced University Courses</Text>
            {uniCourses.map((course: any, index: number) => {
              // Extracting actual names instead of just counts
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
                  {/* Header: Logo and Title inline */}
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

                  {/* Meta: Instructors and Rooms spelled out */}
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

        {/* --- GENERAL COURSES SECTION --- */}
        {generalCourses.length > 0 && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeading}>Personal Courses</Text>
            {generalCourses.map((course: any, index: number) => (
              <View
                key={course._id || `gen-${index}`}
                style={styles.generalCard}
              >
                <View style={styles.generalHeader}>
                  <Ionicons name="book" size={24} color={theme.subtext} />
                  <Text style={styles.generalName}>{course.name}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // --- RENDER: TIMETABLE ---
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
              <Text style={styles.emptyText}>
                No classes scheduled for {selectedDay}.
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
                  <View style={styles.instructorRow}>
                    <Ionicons
                      name="person-outline"
                      size={12}
                      color={theme.subtext}
                    />
                    <Text style={styles.instructorText}>
                      {session.instructor || "Staff"}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Academics</Text>
        <Text style={styles.headerSubtitle}>Manage your weekly schedule</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "courses" && styles.activeTab]}
          onPress={() => setActiveTab("courses")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "courses" && styles.activeTabText,
            ]}
          >
            My Courses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "timetable" && styles.activeTab]}
          onPress={() => setActiveTab("timetable")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "timetable" && styles.activeTabText,
            ]}
          >
            Timetable
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
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text}
            />
          }
        >
          {activeTab === "courses" ? renderCourses() : renderTimetable()}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 24, marginBottom: 25 },
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
    emptySubtext: { color: theme.subtext, fontSize: 13, marginTop: 8 },

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
    instructorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 10,
    },
    instructorText: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // --- MY COURSES GRID ---
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

    // Updated Header Layout
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

    // Updated Meta Layout (Vertical Stack for Names)
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

    // --- GENERAL COURSE CARD ---
    generalCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    generalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    generalName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      flex: 1,
    },
  });
