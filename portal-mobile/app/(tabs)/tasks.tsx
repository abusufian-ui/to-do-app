import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

// --- Web-Matched Priority & Status Helpers ---
const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case "Critical":
      return {
        color: "#EF4444",
        bg: "rgba(239, 68, 68, 0.15)",
        isDouble: true,
      }; // Red
    case "High":
      return {
        color: "#F97316",
        bg: "rgba(249, 115, 22, 0.15)",
        isDouble: false,
      }; // Orange
    case "Medium":
      return {
        color: "#EAB308",
        bg: "rgba(234, 179, 8, 0.15)",
        isDouble: false,
      }; // Yellow
    case "Low":
      return {
        color: "#3B82F6",
        bg: "rgba(59, 130, 246, 0.15)",
        isDouble: false,
      }; // Blue
    default:
      return {
        color: "#737373",
        bg: "rgba(115, 115, 115, 0.15)",
        isDouble: false,
      };
  }
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case "Scheduled":
      return { icon: "calendar-outline", color: "#A3A3A3", label: "Scheduled" };
    case "In Progress":
      return { icon: "time-outline", color: "#EAB308", label: "In Progress" };
    case "New task":
    case "New Assigned":
      return { icon: "mail-outline", color: "#3B82F6", label: "New task" };
    case "Completed":
      return { icon: "checkmark-circle", color: "#22C55E", label: "Completed" };
    default:
      return { icon: "ellipse-outline", color: "#737373", label: status };
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return "No date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Helper: Get local YYYY-MM-DD for accurate comparison
const getLocalYYYYMMDD = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function TasksScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [selectedDateFilter, setSelectedDateFilter] = useState("all");

  const [tasks, setTasks] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedTasks, setExpandedTasks] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [statusSheetTask, setStatusSheetTask] = useState<any>(null);

  // --- DYNAMIC DATE PILL GENERATOR ---
  // --- DYNAMIC DATE PILL GENERATOR ---
  const dateFilters = useMemo(() => {
    // FIX: Explicitly define the TypeScript structure so it accepts both strings and null
    const filters: { id: string; label: string; dateVal: string | null }[] = [
      { id: "all", label: "All Tasks", dateVal: null },
    ];

    const today = new Date();

    filters.push({
      id: "today",
      label: "Today",
      dateVal: getLocalYYYYMMDD(today),
    });

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    filters.push({
      id: "tomorrow",
      label: "Tomorrow",
      dateVal: getLocalYYYYMMDD(tomorrow),
    });

    // Generate Days 3 through 7
    for (let i = 2; i <= 6; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + i);
      const dayName = futureDate.toLocaleDateString("en-US", {
        weekday: "short",
      });
      const dayNum = futureDate.getDate();
      filters.push({
        id: `day_${i}`,
        label: `${dayName} ${dayNum}`,
        dateVal: getLocalYYYYMMDD(futureDate),
      });
    }

    filters.push({ id: "later", label: "Later", dateVal: "later" });
    return filters;
  }, []);

  const fetchData = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!BACKEND_URL) return;

      const token = await AsyncStorage.getItem("userToken");
      const config = { headers: { "x-auth-token": token } };

      const [tasksRes, coursesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/tasks`, config),
        axios.get(`${BACKEND_URL}/courses`, config),
      ]);

      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
    } catch (error) {
      console.error("Fetch Error:", error);
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

  // --- OPTIMISTIC DATABASE UPDATES ---
  const updateTaskInDB = async (taskId: string, updateData: any) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => (t._id === taskId ? { ...t, ...updateData } : t)),
    );
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      await axios.put(`${BACKEND_URL}/tasks/${taskId}`, updateData, {
        headers: { "x-auth-token": token },
      });
    } catch (error) {
      Alert.alert("Sync Error", "Failed to update task. Restoring data.");
      fetchData();
    }
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    const isCompleted = newStatus === "Completed";
    updateTaskInDB(taskId, { status: newStatus, completed: isCompleted });
    setStatusSheetTask(null);
  };

  const toggleSubtask = (taskId: string, subtaskIndex: number) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const updatedSubTasks = JSON.parse(JSON.stringify(task.subTasks));
    updatedSubTasks[subtaskIndex].completed =
      !updatedSubTasks[subtaskIndex].completed;
    updateTaskInDB(taskId, { subTasks: updatedSubTasks });
    if (selectedTask && selectedTask._id === taskId) {
      setSelectedTask({ ...selectedTask, subTasks: updatedSubTasks });
    }
  };

  const toggleExpand = (taskId: string) =>
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));

  const getCourseIcon = (courseName: string) => {
    if (courseName === "Event")
      return <Ionicons name="calendar" size={16} color="#F43F5E" />;
    const matchedCourse = courses.find((c) => c.name === courseName);
    if (
      matchedCourse &&
      (matchedCourse.type === "university" || matchedCourse.type === "uni")
    ) {
      return <UCPLogo width={16} height={16} color="#3B82F6" />;
    }
    return <Ionicons name="book" size={16} color={theme.subtext} />;
  };

  // --- FILTER & SORT LOGIC ---
  const activeTasks = tasks
    .filter((t) => !t.completed)
    .sort(
      (a, b) =>
        new Date(a.date || "9999-12-31").getTime() -
        new Date(b.date || "9999-12-31").getTime(),
    );
  const completedTasks = tasks
    .filter((t) => t.completed)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );

  let displayedTasks = activeTab === "active" ? activeTasks : completedTasks;

  // Apply Date Pill Filter
  if (selectedDateFilter !== "all") {
    if (selectedDateFilter === "later") {
      // "Later" catches anything past day 7, OR anything with no date at all
      const day6 = new Date();
      day6.setDate(day6.getDate() + 6);
      const day6Str = getLocalYYYYMMDD(day6);
      displayedTasks = displayedTasks.filter(
        (t) => !t.date || t.date > day6Str,
      );
    } else if (selectedDateFilter === "today") {
      // "Today" catches today AND any overdue tasks you missed
      const todayStr = getLocalYYYYMMDD(new Date());
      displayedTasks = displayedTasks.filter(
        (t) => t.date && t.date <= todayStr,
      );
    } else {
      // Exact day match for tomorrow, wed, thu, etc.
      const selectedDateVal = dateFilters.find(
        (f) => f.id === selectedDateFilter,
      )?.dateVal;
      displayedTasks = displayedTasks.filter((t) => t.date === selectedDateVal);
    }
  }

  // --- RENDER: TASK SLAB ---
  const renderTask = (task: any) => {
    const priority = getPriorityConfig(task.priority);
    const status = getStatusConfig(task.status);
    const subTasksTotal = task.subTasks?.length || 0;
    const subTasksDone =
      task.subTasks?.filter((s: any) => s.completed).length || 0;
    const isExpanded = expandedTasks[task._id];

    return (
      <View
        key={task._id}
        style={[
          styles.taskCard,
          task.status === "Completed" && styles.taskCardCompleted,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setSelectedTask(task)}
        >
          <View style={styles.taskHeader}>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  styles.taskTitle,
                  task.status === "Completed" && styles.taskTitleCompleted,
                ]}
                numberOfLines={2}
              >
                {task.name}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setStatusSheetTask(task)}
              style={styles.statusBadge}
            >
              <Ionicons
                name={status.icon as any}
                size={14}
                color={status.color}
              />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metaContainer}>
            <View style={styles.metaPill}>
              {getCourseIcon(task.course)}
              <Text style={styles.metaText} numberOfLines={1}>
                {task.course || "General"}
              </Text>
            </View>

            {(task.date || task.time) && (
              <View style={styles.metaPill}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={theme.subtext}
                />
                <Text style={styles.metaText}>
                  {formatDate(task.date)} {task.time ? `• ${task.time}` : ""}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.metaPill,
                { borderColor: priority.bg, backgroundColor: "transparent" },
              ]}
            >
              {priority.isDouble ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name="chevron-up"
                    size={12}
                    color={priority.color}
                    style={{ marginRight: -6 }}
                  />
                  <Ionicons
                    name="chevron-up"
                    size={12}
                    color={priority.color}
                  />
                </View>
              ) : (
                <Ionicons
                  name={
                    task.priority === "High"
                      ? "chevron-up"
                      : task.priority === "Low"
                        ? "arrow-down"
                        : "remove"
                  }
                  size={12}
                  color={priority.color}
                />
              )}
              <Text
                style={[
                  styles.metaText,
                  { color: priority.color, fontWeight: "800" },
                ]}
              >
                {task.priority}
              </Text>
            </View>

            {subTasksTotal > 0 && (
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={() => toggleExpand(task._id)}
                style={[
                  styles.metaPill,
                  {
                    backgroundColor: isExpanded
                      ? theme.invertedBg
                      : theme.background,
                  },
                ]}
              >
                <Ionicons
                  name="list"
                  size={14}
                  color={isExpanded ? theme.invertedText : theme.subtext}
                />
                <Text
                  style={[
                    styles.metaText,
                    isExpanded && { color: theme.invertedText },
                  ]}
                >
                  {subTasksDone}/{subTasksTotal}
                </Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={isExpanded ? theme.invertedText : theme.subtext}
                />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && subTasksTotal > 0 && (
          <View style={styles.subtasksContainer}>
            {task.subTasks.map((sub: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.subtaskRow}
                activeOpacity={0.7}
                onPress={() => toggleSubtask(task._id, index)}
              >
                <Ionicons
                  name={sub.completed ? "checkbox" : "square-outline"}
                  size={20}
                  color={sub.completed ? "#22C55E" : theme.subtext}
                />
                <Text
                  style={[
                    styles.subtaskText,
                    sub.completed && styles.subtaskTextCompleted,
                  ]}
                >
                  {sub.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        <Text style={styles.headerSubtitle}>Manage your priorities</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "active" && styles.activeTab]}
          onPress={() => setActiveTab("active")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "active" && styles.activeTabText,
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "completed" && styles.activeTab]}
          onPress={() => setActiveTab("completed")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "completed" && styles.activeTabText,
            ]}
          >
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- HORIZONTAL DATE PILL FILTER --- */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateFilterContainer}
        >
          {dateFilters.map((filter) => {
            const isActive = selectedDateFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                activeOpacity={0.7}
                onPress={() => setSelectedDateFilter(filter.id)}
                style={[styles.datePill, isActive && styles.activeDatePill]}
              >
                <Text
                  style={[
                    styles.datePillText,
                    isActive && styles.activeDatePillText,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content */}
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
          {displayedTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={
                  activeTab === "active"
                    ? "checkmark-done-circle-outline"
                    : "file-tray-outline"
                }
                size={64}
                color={theme.border}
              />
              <Text style={styles.emptyText}>
                {selectedDateFilter !== "all"
                  ? "Nothing scheduled here!"
                  : "You're all caught up!"}
              </Text>
            </View>
          ) : (
            displayedTasks.map(renderTask)
          )}
        </ScrollView>
      )}

      {/* --- STATUS CHANGER BOTTOM SHEET MODAL --- */}
      <Modal visible={!!statusSheetTask} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setStatusSheetTask(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.bottomSheet}>
                <Text style={styles.sheetHeader}>Change Status</Text>
                {["New task", "Scheduled", "In Progress", "Completed"].map(
                  (status) => {
                    const sConf = getStatusConfig(status);
                    const isCurrent = statusSheetTask?.status === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.sheetRow,
                          isCurrent && { backgroundColor: theme.background },
                        ]}
                        onPress={() =>
                          handleStatusChange(statusSheetTask._id, status)
                        }
                      >
                        <Ionicons
                          name={sConf.icon as any}
                          size={20}
                          color={sConf.color}
                        />
                        <Text
                          style={[
                            styles.sheetText,
                            isCurrent && { fontWeight: "bold" },
                          ]}
                        >
                          {status}
                        </Text>
                        {isCurrent && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={theme.text}
                            style={{ marginLeft: "auto" }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* --- FULL TASK SUMMARY MODAL --- */}
      <Modal visible={!!selectedTask} transparent animationType="slide">
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.fullModalHeader}>
              <View style={styles.headerIconBg}>
                <Ionicons name="information-circle" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.fullModalTitle}>Task Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedTask(null)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24 }}
            >
              <Text style={styles.summaryTitle}>{selectedTask?.name}</Text>
              <View style={styles.summaryDescBox}>
                <Ionicons
                  name="menu"
                  size={18}
                  color={theme.subtext}
                  style={{ marginTop: 2 }}
                />
                <Text style={styles.summaryDescText}>
                  {selectedTask?.description ||
                    "No additional notes provided for this task."}
                </Text>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryGridItem}>
                  <Text style={styles.gridLabel}>Course</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    {getCourseIcon(selectedTask?.course)}
                    <Text style={styles.gridValue}>
                      {selectedTask?.course || "General"}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryGridItem}>
                  <Text style={styles.gridLabel}>Due Date</Text>
                  <Text style={styles.gridValue}>
                    {formatDate(selectedTask?.date)}
                  </Text>
                </View>
                <View style={styles.summaryGridItem}>
                  <Text style={styles.gridLabel}>Priority</Text>
                  <Text
                    style={[
                      styles.gridValue,
                      {
                        color: getPriorityConfig(selectedTask?.priority).color,
                      },
                    ]}
                  >
                    {selectedTask?.priority}
                  </Text>
                </View>
                <View style={styles.summaryGridItem}>
                  <Text style={styles.gridLabel}>Status</Text>
                  <Text
                    style={[
                      styles.gridValue,
                      { color: getStatusConfig(selectedTask?.status).color },
                    ]}
                  >
                    {selectedTask?.status}
                  </Text>
                </View>
              </View>
              {selectedTask?.subTasks?.length > 0 && (
                <View style={styles.modalSubtaskBox}>
                  <Text style={styles.modalSubtaskHeader}>SUB TASKS</Text>
                  {selectedTask.subTasks.map((sub: any, index: number) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.subtaskRow}
                      activeOpacity={0.7}
                      onPress={() => toggleSubtask(selectedTask._id, index)}
                    >
                      <Ionicons
                        name={sub.completed ? "checkbox" : "square-outline"}
                        size={22}
                        color={sub.completed ? "#22C55E" : theme.subtext}
                      />
                      <Text
                        style={[
                          styles.subtaskText,
                          sub.completed && styles.subtaskTextCompleted,
                          { fontSize: 14 },
                        ]}
                      >
                        {sub.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 24, marginBottom: 20 },
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
      marginBottom: 15,
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

    // --- HORIZONTAL DATE FILTER PILLS ---
    dateFilterContainer: { paddingHorizontal: 24, paddingBottom: 15, gap: 10 },
    datePill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
    },
    activeDatePill: {
      backgroundColor: theme.invertedBg,
      borderColor: theme.invertedBg,
    },
    datePillText: { fontSize: 13, fontWeight: "800", color: theme.text },
    activeDatePillText: { color: theme.invertedText },

    scrollContent: { paddingHorizontal: 24, paddingBottom: 100, gap: 16 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      opacity: 0.8,
    },
    emptyText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 20,
      letterSpacing: -0.5,
    },

    // --- TASK SLAB ---
    taskCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    taskCardCompleted: { opacity: 0.6, backgroundColor: theme.background },

    taskHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 16,
    },
    titleContainer: { flex: 1 },
    taskTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      lineHeight: 22,
    },
    taskTitleCompleted: {
      textDecorationLine: "line-through",
      color: theme.subtext,
    },

    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    metaContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metaText: { fontSize: 11, fontWeight: "700", color: theme.subtext },

    // --- EXPANDABLE SUBTASKS ---
    subtasksContainer: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 12,
    },
    subtaskRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    subtaskText: {
      fontSize: 13,
      color: theme.text,
      flex: 1,
      fontWeight: "500",
    },
    subtaskTextCompleted: {
      textDecorationLine: "line-through",
      color: theme.subtext,
      fontStyle: "italic",
    },

    // --- STATUS BOTTOM SHEET MODAL ---
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    bottomSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    sheetHeader: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 16,
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sheetText: { fontSize: 16, color: theme.text, fontWeight: "500" },

    // --- FULL SUMMARY MODAL ---
    fullModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 16,
    },
    fullModalContent: {
      backgroundColor: theme.card,
      borderRadius: 24,
      maxHeight: "80%",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    fullModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerIconBg: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      justifyContent: "center",
      alignItems: "center",
    },
    fullModalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      flex: 1,
      marginLeft: 12,
    },
    closeBtn: {
      padding: 4,
      backgroundColor: theme.background,
      borderRadius: 20,
    },

    summaryTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 16,
    },
    summaryDescBox: { flexDirection: "row", gap: 10, marginBottom: 24 },
    summaryDescText: {
      fontSize: 14,
      color: theme.subtext,
      flex: 1,
      lineHeight: 22,
    },

    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 20,
      marginBottom: 24,
    },
    summaryGridItem: { width: "50%", marginBottom: 20 },
    gridLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.subtext,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    gridValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
      marginTop: 4,
    },

    modalSubtaskBox: {
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    modalSubtaskHeader: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
      marginBottom: 4,
    },
  });
