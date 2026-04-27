import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    useColorScheme,
    View
} from "react-native";

// --- UNIFIED APP COLOR PALETTE ---
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

export default function DatesheetScreen() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  useEffect(() => {
    fetchDatesheet();
  }, []);

  const fetchDatesheet = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const res = await axios.get(`${BACKEND_URL}/datesheet`, {
        headers: { "x-auth-token": token },
      });
      setExams(res.data);
    } catch (error) {
      console.log("Failed to load datesheet", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDatesheet();
  };

  const calculateDaysRemaining = (examDate: string) => {
    if (!examDate) return "Unknown";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = examDate.split("-").map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 0) return "Completed";
    return `In ${diffDays} Days`;
  };

  const renderExamCard = ({ item }: { item: any }) => {
    const daysRemaining = calculateDaysRemaining(item.date);
    const isCompleted = daysRemaining === "Completed";
    const isToday = daysRemaining === "Today";

    const [year, monthNum, dayStr] = item.date.split("-");
    const dateObj = new Date(
      Number(year),
      Number(monthNum) - 1,
      Number(dayStr),
    );
    const month = dateObj
      .toLocaleString("default", { month: "short" })
      .toUpperCase();
    const day = dateObj.getDate().toString().padStart(2, "0");

    return (
      <View style={[styles.card, isCompleted && { opacity: 0.6 }]}>
        <View style={styles.dateBadge}>
          <Text style={styles.badgeMonth}>{month}</Text>
          <Text style={styles.badgeDay}>{day}</Text>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.courseName} numberOfLines={2}>
            {item.courseName}
          </Text>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color={theme.subtext} />
            <Text style={styles.infoText}>{item.time}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color={theme.subtext} />
            <Text style={styles.infoText}>
              Venue:{" "}
              <Text style={{ fontWeight: "800", color: theme.text }}>
                {item.venue}
              </Text>
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={14} color={theme.subtext} />
            <Text style={styles.infoText}>{item.instructor}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              isCompleted
                ? { backgroundColor: theme.border }
                : isToday
                  ? { backgroundColor: theme.roseBg }
                  : { backgroundColor: theme.amberBg },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isCompleted
                  ? { color: theme.subtext }
                  : isToday
                    ? { color: theme.rose }
                    : { color: theme.amber },
              ]}
            >
              {daysRemaining}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {exams.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={54} color={theme.emerald} />
          </View>
          <Text style={styles.emptyTitle}>No Exams Scheduled</Text>
          <Text style={styles.emptySub}>
            You're all clear! Enjoy the peace while it lasts.
          </Text>
        </View>
      ) : (
        <FlatList
          data={exams}
          keyExtractor={(item) => item._id}
          renderItem={renderExamCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text}
            />
          }
        />
      )}
    </View>
  );
}

// --- DYNAMIC STYLESHEET ---
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    listContainer: {
      paddingHorizontal: 24,
      paddingBottom: 100,
      paddingTop: 20, // 🚨 Added comfortable padding below the global header
    },

    card: {
      flexDirection: "row",
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dateBadge: {
      backgroundColor: theme.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      alignItems: "center",
      justifyContent: "center",
      width: 70,
      height: 80,
      marginRight: 16,
    },
    badgeMonth: {
      fontSize: 12,
      fontWeight: "900",
      color: theme.blue,
      letterSpacing: 1,
    },
    badgeDay: {
      fontSize: 26,
      fontWeight: "900",
      color: theme.text,
      marginTop: -2,
    },

    cardContent: { flex: 1, justifyContent: "center" },
    courseName: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 12,
      lineHeight: 22,
      letterSpacing: -0.3,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    infoText: {
      fontSize: 13,
      color: theme.subtext,
      fontWeight: "600",
      marginLeft: 8,
    },

    statusPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 10,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      marginTop: -50, // Adjusted to visually center without the custom header
    },
    iconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.emeraldBg,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "rgba(16, 185, 129, 0.2)",
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    emptySub: {
      fontSize: 15,
      color: theme.subtext,
      textAlign: "center",
      fontWeight: "500",
      paddingHorizontal: 40,
      lineHeight: 22,
    },
  });
