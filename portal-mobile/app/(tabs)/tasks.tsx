import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
    background: "#F1F5F9",
    card: "#FFFFFF",
    text: "#0F172A",
    subtext: "#64748B",
    border: "#E2E8F0",
    primary: "#38BDF8",
    highPriority: "#EF4444",
    mediumPriority: "#F59E0B",
    lowPriority: "#10B981",
  },
  dark: {
    background: "#020617",
    card: "#0F172A",
    text: "#F8FAFC",
    subtext: "#94A3B8",
    border: "#1E293B",
    primary: "#38BDF8",
    highPriority: "#EF4444",
    mediumPriority: "#F59E0B",
    lowPriority: "#10B981",
  },
};

export default function TasksScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const response = await axios.get(`${BACKEND_URL}/tasks`); // Ensure this matches your route

      // Filter out deleted tasks if they are returned by the API
      const activeTasks = response.data.filter((task: any) => !task.isDeleted);
      setTasks(activeTasks);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);
  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  // Helper function to color code priority
  const getPriorityColor = (priority: string) => {
    if (priority === "High") return theme.highPriority;
    if (priority === "Medium") return theme.mediumPriority;
    return theme.lowPriority;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Action Items</Text>
        <Text style={styles.headerSubtitle}>
          {tasks.filter((t: any) => !t.completed).length} pending tasks
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>You're all caught up!</Text>
          ) : (
            tasks.map((task: any) => (
              <View key={task._id} style={styles.taskCard}>
                {/* Checkbox and Title */}
                <View style={styles.taskHeader}>
                  <TouchableOpacity>
                    <Ionicons
                      name={
                        task.completed ? "checkmark-circle" : "ellipse-outline"
                      }
                      size={24}
                      color={task.completed ? theme.lowPriority : theme.subtext}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.taskTitle,
                      task.completed && styles.taskCompleted,
                    ]}
                  >
                    {task.name}
                  </Text>
                </View>

                {/* Optional Description */}
                {task.description ? (
                  <Text style={styles.taskDesc} numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}

                {/* Badges for Course, Date, and Priority */}
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Ionicons
                      name="folder-outline"
                      size={12}
                      color={theme.primary}
                    />
                    <Text style={[styles.badgeText, { color: theme.primary }]}>
                      {task.course}
                    </Text>
                  </View>

                  {(task.date || task.time) && (
                    <View style={styles.badge}>
                      <Ionicons
                        name="calendar-outline"
                        size={12}
                        color={theme.subtext}
                      />
                      <Text style={styles.badgeText}>
                        {task.date} {task.time ? `• ${task.time}` : ""}
                      </Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.badge,
                      { borderColor: getPriorityColor(task.priority) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: getPriorityColor(task.priority) },
                      ]}
                    >
                      {task.priority}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
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
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 15 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      color: theme.subtext,
      textAlign: "center",
      marginTop: 40,
      fontSize: 16,
    },

    taskCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    taskHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    taskTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      flex: 1,
    },
    taskCompleted: {
      textDecorationLine: "line-through",
      color: theme.subtext,
    },
    taskDesc: {
      fontSize: 14,
      color: theme.subtext,
      marginLeft: 36, // Align with the text, skipping the checkbox
      marginBottom: 12,
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginLeft: 36,
      marginTop: 8,
    },
    badge: {
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
    badgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.subtext,
    },
  });
