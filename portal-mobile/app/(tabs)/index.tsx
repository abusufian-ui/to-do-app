import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const todaysClasses = [
  {
    id: "1",
    name: "Operating Systems",
    type: "Lab",
    time: "08:30 AM",
    room: "L-402",
    color: "#38BDF8",
  },
  {
    id: "2",
    name: "Diff. Equations",
    type: "Lecture",
    time: "10:00 AM",
    room: "R-105",
    color: "#A855F7",
  },
  {
    id: "3",
    name: "Software Eng.",
    type: "Lecture",
    time: "11:30 AM",
    room: "R-201",
    color: "#F59E0B",
  },
  {
    id: "4",
    name: "Game Dev",
    type: "Lab",
    time: "01:00 PM",
    room: "L-304",
    color: "#10B981",
  },
  {
    id: "5",
    name: "DAA",
    type: "Lecture",
    time: "02:30 PM",
    room: "R-110",
    color: "#EF4444",
  },
];

const todaysTasks = [
  { id: "1", text: "Submit OS Lab Report", done: true },
  { id: "2", text: "Revise Diff. Equations Ch 4", done: false },
  { id: "3", text: "Draft UI for THE ZETA AI", done: false },
  { id: "4", text: "Review MERN API endpoints", done: false },
];

const Colors = {
  light: {
    background: "#F1F5F9",
    card: "#FFFFFF",
    text: "#0F172A",
    subtext: "#64748B",
    border: "#E2E8F0",
    priorityBg: "#EEF2FF",
    priorityBorder: "#C7D2FE",
    roomBadgeBg: "#F1F5F9",
    roomBadgeText: "#475569",
    iconColor: "#0F172A",
  },
  dark: {
    background: "#020617",
    card: "#0F172A",
    text: "#F8FAFC",
    subtext: "#94A3B8",
    border: "#1E293B",
    priorityBg: "#1E1B4B",
    priorityBorder: "#312E81",
    roomBadgeBg: "#1E293B",
    roomBadgeText: "#E2E8F0",
    iconColor: "#F8FAFC",
  },
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const styles = getStyles(theme);

  return (
    <View style={styles.mainContainer}>
      {isDark && <View style={styles.glowTop} />}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>SATURDAY, FEB 14</Text>
            <Text style={styles.greeting}>Welcome Sufi</Text>
          </View>
          <TouchableOpacity style={styles.profilePic}>
            <Ionicons name="person" size={20} color={theme.background} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <Text style={styles.sectionSubtitle}>
            {todaysClasses.length} Classes
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
        >
          {todaysClasses.map((cls) => (
            <View
              key={cls.id}
              style={[styles.classCard, { borderTopColor: cls.color }]}
            >
              <View style={styles.classCardTop}>
                <Ionicons name="time-outline" size={14} color={theme.subtext} />
                <Text style={styles.classTime}>{cls.time}</Text>
              </View>
              <Text style={styles.className} numberOfLines={2}>
                {cls.name}
              </Text>
              <View style={styles.classCardBottom}>
                <Text style={styles.classType}>{cls.type}</Text>
                <View style={styles.roomBadge}>
                  <Text style={styles.roomText}>{cls.room}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.bentoBox, styles.priorityBox]}>
          <View style={styles.priorityHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>URGENT</Text>
            </View>
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={theme.subtext}
            />
          </View>
          <Text style={styles.priorityTask}>Complete DAA Graph Algorithms</Text>
          <Text style={styles.prioritySub}>Due tonight at 11:59 PM</Text>
        </View>

        <View style={styles.bentoBox}>
          <View style={styles.taskHeaderRow}>
            <Text style={styles.boxLabel}>Action Items</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {todaysTasks.slice(0, 3).map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <Ionicons
                name={task.done ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={task.done ? "#10B981" : theme.subtext}
              />
              <Text style={[styles.taskText, task.done && styles.taskTextDone]}>
                {task.text}
              </Text>
            </View>
          ))}
          {todaysTasks.length > 3 && (
            <Text style={styles.moreTasksText}>
              + {todaysTasks.length - 3} more tasks today
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// FIXED: Added : any to the theme variable
const getStyles = (theme: any) =>
  StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: theme.background },
    glowTop: {
      position: "absolute",
      top: -100,
      left: -50,
      width: 300,
      height: 300,
      backgroundColor: "#38BDF8",
      opacity: 0.15,
      borderRadius: 150,
    },
    scrollContent: { paddingTop: 60, paddingBottom: 100 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 25,
      paddingHorizontal: 20,
    },
    dateText: {
      color: "#38BDF8",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    greeting: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.text,
      letterSpacing: -0.5,
    },
    profilePic: {
      width: 45,
      height: 45,
      backgroundColor: "#38BDF8",
      borderRadius: 22.5,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingHorizontal: 20,
      marginBottom: 15,
    },
    sectionTitle: { fontSize: 18, fontWeight: "bold", color: theme.text },
    sectionSubtitle: { fontSize: 14, color: theme.subtext },
    carouselContainer: { paddingHorizontal: 20, paddingBottom: 25, gap: 15 },
    classCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      width: 160,
      borderWidth: 1,
      borderColor: theme.border,
      borderTopWidth: 4,
    },
    classCardTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      gap: 5,
    },
    classTime: { color: theme.subtext, fontSize: 12, fontWeight: "600" },
    className: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      height: 40,
      marginBottom: 10,
    },
    classCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    classType: { color: theme.subtext, fontSize: 12 },
    roomBadge: {
      backgroundColor: theme.roomBadgeBg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    roomText: { color: theme.roomBadgeText, fontSize: 10, fontWeight: "bold" },
    bentoBox: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      marginHorizontal: 20,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.border,
    },
    priorityBox: {
      backgroundColor: theme.priorityBg,
      borderColor: theme.priorityBorder,
    },
    priorityHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    badge: {
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    badgeText: {
      color: "#EF4444",
      fontSize: 10,
      fontWeight: "bold",
      letterSpacing: 1,
    },
    priorityTask: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 8,
    },
    prioritySub: { color: theme.subtext, fontSize: 14 },
    taskHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    boxLabel: { color: theme.subtext, fontSize: 14, fontWeight: "600" },
    viewAllText: { color: "#38BDF8", fontSize: 13, fontWeight: "600" },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 12,
    },
    taskText: { color: theme.text, fontSize: 15, flex: 1 },
    taskTextDone: { color: theme.subtext, textDecorationLine: "line-through" },
    moreTasksText: {
      color: theme.subtext,
      fontSize: 13,
      textAlign: "center",
      marginTop: 15,
      fontStyle: "italic",
    },
  });
