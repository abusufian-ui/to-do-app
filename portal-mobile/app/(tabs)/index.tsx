import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// IMPORT YOUR BRAND NEW UCP LOGO
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

// --- Mock Data: Full Daily Schedule ---
const stats = { cgpa: "3.64", credits: "84" };
const nextClass = {
  name: "Differential Equations",
  time: "10:00 AM",
  room: "R-105",
  startsIn: "45 mins",
};

const todaysClasses = [
  {
    id: "1",
    name: "Operating Systems",
    type: "Lab",
    time: "08:30 AM",
    endTime: "09:50 AM",
    room: "L-402",
  },
  {
    id: "2",
    name: "Differential Equations",
    type: "Lecture",
    time: "10:00 AM",
    endTime: "11:20 AM",
    room: "R-105",
  },
  {
    id: "3",
    name: "Software Engineering",
    type: "Lecture",
    time: "11:30 AM",
    endTime: "12:50 PM",
    room: "R-201",
  },
  {
    id: "4",
    name: "Game Dev (Unity)",
    type: "Lab",
    time: "01:00 PM",
    endTime: "02:20 PM",
    room: "L-304",
  },
  {
    id: "5",
    name: "DAA",
    type: "Lecture",
    time: "02:30 PM",
    endTime: "03:50 PM",
    room: "R-110",
  },
];

const todaysTasks = [
  {
    id: "1",
    text: "Initialize The Zeta AI repository",
    course: "FYP",
    done: true,
  },
  {
    id: "2",
    text: "Deploy web portal frontend to Vercel",
    course: "Web Dev",
    done: false,
  },
  {
    id: "3",
    text: "Complete OS Lab Report",
    course: "Operating Systems",
    done: false,
  },
];

export default function HomeScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const insets = useSafeAreaInsets();

  // THE FIX: Directly grab Android's native hardware status bar height.
  // If on iOS, it falls back to the safe area insets.
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const today = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();

  return (
    // Apply the foolproof statusBarHeight to the wrapper View
    <View style={[styles.safeArea, { paddingTop: statusBarHeight }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- HEADER --- */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>{today}</Text>
            <Text style={styles.greeting}>Abu Sufian</Text>
            <Text style={styles.subtitle}>BSCS Command Center</Text>
          </View>
          <TouchableOpacity style={styles.profileAvatar}>
            <Text style={styles.avatarText}>AS</Text>
          </TouchableOpacity>
        </View>

        {/* --- BENTO GRID ARCHITECTURE --- */}
        <View style={styles.bentoContainer}>
          <View style={[styles.bentoBox, styles.heroBox]}>
            <View style={styles.heroHeader}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>UP NEXT</Text>
              </View>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={theme.invertedText}
              />
            </View>
            <Text style={styles.heroTitle}>{nextClass.name}</Text>
            <Text style={styles.heroSub}>
              Starts in {nextClass.startsIn} • Room {nextClass.room}
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
              <Text style={styles.bentoValue}>1 / 3</Text>
              <Text style={styles.bentoLabel}>Tasks Done</Text>
            </View>
          </View>
        </View>

        {/* --- FULL DAILY SCHEDULE (VERTICAL TIMELINE) --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
        </View>

        <View style={styles.timelineContainer}>
          {todaysClasses.map((cls, index) => (
            <View key={cls.id} style={styles.timelineRow}>
              {/* Left Side: Time & Line */}
              <View style={styles.timelineLeft}>
                <Text style={styles.timelineTime}>{cls.time}</Text>
                {/* Don't show the connecting line after the last class */}
                {index !== todaysClasses.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
                <View style={styles.timelineDot} />
              </View>

              {/* Right Side: Class Details Card */}
              <View style={styles.timelineCard}>
                {/* The UCP Logo & Subject Name Row */}
                <View style={styles.courseHeaderRow}>
                  <UCPLogo
                    width={18}
                    height={18}
                    color={theme.text}
                    style={styles.ucpIcon}
                  />
                  <Text style={styles.className} numberOfLines={1}>
                    {cls.name}
                  </Text>
                </View>

                <View style={styles.classFooter}>
                  <Text style={styles.classDuration}>
                    {cls.time} - {cls.endTime}
                  </Text>
                  <View style={styles.roomBadge}>
                    <Text style={styles.roomText}>{cls.room}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* --- ACTION ITEMS LIST --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Action Items</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.taskList}>
          {todaysTasks.map((task, index) => (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.taskRow,
                index === todaysTasks.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
                {task.done && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={theme.invertedText}
                  />
                )}
              </View>
              <View style={styles.taskInfo}>
                <Text
                  style={[styles.taskText, task.done && styles.taskTextDone]}
                >
                  {task.text}
                </Text>
                <Text style={styles.taskCourse}>{task.course}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingTop: 20, paddingBottom: 100 },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      marginBottom: 30,
    },
    dateText: {
      color: theme.subtext,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    greeting: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -1,
      marginBottom: 4,
    },
    subtitle: { fontSize: 16, color: theme.subtext, fontWeight: "500" },
    profileAvatar: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: theme.invertedBg,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { color: theme.invertedText, fontSize: 20, fontWeight: "800" },

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
      fontWeight: "800",
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
    linkText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.subtext,
      textDecorationLine: "underline",
    },

    // --- TIMELINE STYLES ---
    timelineContainer: { paddingHorizontal: 24, paddingBottom: 35 },
    timelineRow: { flexDirection: "row", marginBottom: 16 },
    timelineLeft: { width: 70, alignItems: "center", marginRight: 15 },
    timelineTime: {
      fontSize: 13,
      fontWeight: "700",
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
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },

    // UCP Icon & Course Name Wrapper
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
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    taskTextDone: { color: theme.subtext, textDecorationLine: "line-through" },
    taskCourse: { fontSize: 13, color: theme.subtext, fontWeight: "500" },
  });
