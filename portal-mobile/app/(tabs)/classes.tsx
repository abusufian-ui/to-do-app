import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
// NEW: Import AsyncStorage to get your login token
import AsyncStorage from "@react-native-async-storage/async-storage";

const Colors = {
  light: {
    background: "#F1F5F9",
    card: "#FFFFFF",
    text: "#0F172A",
    subtext: "#64748B",
    border: "#E2E8F0",
    activeTab: "#38BDF8",
    inactiveTab: "#F8FAFC",
    iconBg: "#EEF2FF",
  },
  dark: {
    background: "#020617",
    card: "#0F172A",
    text: "#F8FAFC",
    subtext: "#94A3B8",
    border: "#1E293B",
    activeTab: "#38BDF8",
    inactiveTab: "#1E293B",
    iconBg: "#1E1B4B",
  },
};

export default function ClassesScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [activeTab, setActiveTab] = useState<"courses" | "timetable">(
    "courses",
  );
  const [courses, setCourses] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

      if (!BACKEND_URL) {
        console.error("Missing Backend URL");
        return;
      }

      // 1. GET THE SAVED TOKEN FROM YOUR LOGIN
      const token = await AsyncStorage.getItem("userToken");

      // 2. ATTACH THE TOKEN TO THE HEADERS
      const config = {
        headers: { "x-auth-token": token },
      };

      // 3. SEND THE REQUEST WITH THE SECURE CONFIG
      const [coursesRes, timetableRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/courses`, config),
        axios.get(`${BACKEND_URL}/timetable`, config),
      ]);

      setCourses(coursesRes.data);
      setTimetable(timetableRes.data);
    } catch (error: any) {
      console.error("Failed to fetch university data:", error);

      // If the server rejects the token (401), alert the user
      if (error.response && error.response.status === 401) {
        Alert.alert(
          "Not Logged In",
          "Please go to the Login screen to authenticate your session.",
        );
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderCourses = () => {
    if (courses.length === 0)
      return <Text style={styles.emptyText}>No active courses found.</Text>;
    return courses.map((course: any, index: number) => (
      <View
        key={index}
        style={[
          styles.card,
          {
            borderLeftWidth: 4,
            borderLeftColor: course.color || theme.activeTab,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="book"
              size={20}
              color={course.color || theme.activeTab}
            />
          </View>
          <Text style={styles.courseCode}>{course.code || "N/A"}</Text>
        </View>
        <Text style={styles.courseName}>{course.name}</Text>
        <View style={styles.courseFooter}>
          <Text style={styles.footerText}>Type: {course.type}</Text>
        </View>
      </View>
    ));
  };

  const renderTimetable = () => {
    if (timetable.length === 0)
      return <Text style={styles.emptyText}>No classes scheduled.</Text>;
    return timetable.map((session: any, index: number) => (
      <View key={index} style={styles.card}>
        <View style={styles.timeRow}>
          <Text style={styles.dayText}>{session.day}</Text>
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>
              {session.startTime} - {session.endTime}
            </Text>
          </View>
        </View>
        <Text style={styles.courseName}>{session.courseName}</Text>
        <View style={styles.courseFooter}>
          <Text style={styles.roomText}>
            <Ionicons name="location-outline" size={14} /> Room: {session.room}
          </Text>
          <Text style={styles.roomText}>
            <Ionicons name="person-outline" size={14} /> {session.instructor}
          </Text>
        </View>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Academics</Text>
        <Text style={styles.headerSubtitle}>University Portal Sync</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "courses" && styles.activeTab]}
          onPress={() => setActiveTab("courses")}
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
          <ActivityIndicator size="large" color={theme.activeTab} />
          <Text style={styles.loadingText}>Syncing with portal...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.activeTab}
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
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
    headerTitle: { fontSize: 28, fontWeight: "bold", color: theme.text },
    headerSubtitle: { fontSize: 15, color: theme.subtext, marginTop: 5 },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: theme.inactiveTab,
      marginHorizontal: 20,
      borderRadius: 12,
      padding: 4,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 8,
    },
    activeTab: { backgroundColor: theme.activeTab },
    tabText: { fontSize: 14, fontWeight: "600", color: theme.text },
    activeTabText: { color: "#FFFFFF" },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 15 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: { color: theme.subtext, marginTop: 15, fontSize: 16 },
    emptyText: {
      color: theme.subtext,
      textAlign: "center",
      marginTop: 40,
      fontSize: 16,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.iconBg,
      alignItems: "center",
      justifyContent: "center",
    },
    courseCode: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.subtext,
      letterSpacing: 1,
    },
    courseName: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 15,
    },
    courseFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
      marginTop: 5,
    },
    footerText: {
      fontSize: 13,
      color: theme.subtext,
      textTransform: "capitalize",
    },
    timeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    dayText: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.activeTab,
      textTransform: "uppercase",
    },
    timeBadge: {
      backgroundColor: theme.iconBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    timeText: { fontSize: 12, fontWeight: "bold", color: theme.text },
    roomText: { fontSize: 13, color: theme.subtext },
  });
