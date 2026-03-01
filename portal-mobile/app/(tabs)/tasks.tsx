import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Notifications from "expo-notifications";
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

export async function scheduleSmartAlert(
  title: string,
  body: string,
  exactDate: Date,
  eventId: string,
  type: "task" | "class",
) {
  const offsetMinutes = type === "task" ? 15 : 5;
  const warningDate = new Date(exactDate.getTime() - offsetMinutes * 60000);

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
      trigger: warningDate as any,
    });
  }

  if (exactDate > new Date()) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${eventId}-exact`,
      content: {
        title: `🔴 NOW: ${title}`,
        body: `It's time to start!`,
        data: { eventId, type: "exact" },
        sound: true,
      },
      trigger: exactDate as any,
    });
  }
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case "Critical":
      return {
        color: "#EF4444",
        bg: "rgba(239, 68, 68, 0.15)",
        isDouble: true,
      };
    case "High":
      return {
        color: "#F97316",
        bg: "rgba(249, 115, 22, 0.15)",
        isDouble: false,
      };
    case "Medium":
      return {
        color: "#EAB308",
        bg: "rgba(234, 179, 8, 0.15)",
        isDouble: false,
      };
    case "Low":
      return {
        color: "#3B82F6",
        bg: "rgba(59, 130, 246, 0.15)",
        isDouble: false,
      };
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
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

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
  const [isOffline, setIsOffline] = useState(false); // GLOBAL OFFLINE STATE

  const [expandedTasks, setExpandedTasks] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [statusSheetTask, setStatusSheetTask] = useState<any>(null);

  const dateFilters = useMemo(() => {
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

    for (let i = 2; i <= 6; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + i);
      filters.push({
        id: `day_${i}`,
        label: `${futureDate.toLocaleDateString("en-US", { weekday: "short" })} ${futureDate.getDate()}`,
        dateVal: getLocalYYYYMMDD(futureDate),
      });
    }
    filters.push({ id: "later", label: "Later", dateVal: "later" });
    return filters;
  }, []);

  const syncTaskNotifications = async (tasksList: any[]) => {
    const generalNotifs = await AsyncStorage.getItem("generalNotifs");
    if (generalNotifs !== "true") return;

    const active = tasksList.filter((t) => !t.completed && t.date && t.time);
    for (const task of active) {
      try {
        const exactDate = new Date(`${task.date}T${task.time}:00`);
        if (!isNaN(exactDate.getTime()) && exactDate > new Date()) {
          await scheduleSmartAlert(
            task.name,
            `Your task starts in 15 minutes. Acknowledge to mute final alarm.`,
            exactDate,
            `task-${task._id}`,
            "task",
          );
        }
      } catch (e) {}
    }
  };

  const fetchData = async () => {
    try {
      const [cTasks, cCourses] = await Promise.all([
        AsyncStorage.getItem("off_tasks_data"),
        AsyncStorage.getItem("off_tasks_courses"),
      ]);
      if (cTasks) setTasks(JSON.parse(cTasks));
      if (cCourses) setCourses(JSON.parse(cCourses));
      if (cTasks || cCourses) setIsLoading(false);

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) return setIsLoading(false);

      // AGGRESSIVE CACHE BUSTING HEADERS
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
        axios.get(`${BACKEND_URL}/tasks?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/courses?t=${timestamp}`, config),
      ]);

      // DETECT OFFLINE MODE
      const isAnyRejected = results.some((r) => r.status === "rejected");
      setIsOffline(isAnyRejected);

      if (results[0].status === "fulfilled") {
        const freshTasks = Array.isArray(results[0].value.data)
          ? results[0].value.data
          : [];
        setTasks(freshTasks);
        AsyncStorage.setItem("off_tasks_data", JSON.stringify(freshTasks));
        syncTaskNotifications(freshTasks);
      }

      if (results[1].status === "fulfilled") {
        const freshCourses = Array.isArray(results[1].value.data)
          ? results[1].value.data
          : [];
        setCourses(freshCourses);
        AsyncStorage.setItem("off_tasks_courses", JSON.stringify(freshCourses));
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
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const updateTaskInDB = async (taskId: string, updateData: any) => {
    const updated = tasks.map((t) =>
      t._id === taskId ? { ...t, ...updateData } : t,
    );
    setTasks(updated);
    AsyncStorage.setItem("off_tasks_data", JSON.stringify(updated));
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
    updateTaskInDB(taskId, {
      status: newStatus,
      completed: newStatus === "Completed",
    });
    setStatusSheetTask(null);
  };

  const toggleSubtask = (taskId: string, subtaskIndex: number) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const updatedSubTasks = JSON.parse(JSON.stringify(task.subTasks));
    updatedSubTasks[subtaskIndex].completed =
      !updatedSubTasks[subtaskIndex].completed;
    updateTaskInDB(taskId, { subTasks: updatedSubTasks });
    if (selectedTask && selectedTask._id === taskId)
      setSelectedTask({ ...selectedTask, subTasks: updatedSubTasks });
  };

  const toggleExpand = (taskId: string) =>
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));

  const getCourseIcon = (courseName: string) => {
    if (courseName === "Event")
      return <Ionicons name="calendar" size={14} color="#F43F5E" />;
    const matchedCourse = courses.find((c) => c.name === courseName);
    if (
      matchedCourse &&
      (matchedCourse.type === "university" || matchedCourse.type === "uni")
    )
      return <UCPLogo width={14} height={14} color={theme.text} />;
    return <Ionicons name="book" size={14} color={theme.subtext} />;
  };

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

  if (selectedDateFilter !== "all") {
    if (selectedDateFilter === "later") {
      const day6 = new Date();
      day6.setDate(day6.getDate() + 6);
      displayedTasks = displayedTasks.filter(
        (t) => !t.date || t.date > getLocalYYYYMMDD(day6),
      );
    } else if (selectedDateFilter === "today") {
      displayedTasks = displayedTasks.filter(
        (t) => t.date && t.date <= getLocalYYYYMMDD(new Date()),
      );
    } else {
      const selectedDateVal = dateFilters.find(
        (f) => f.id === selectedDateFilter,
      )?.dateVal;
      displayedTasks = displayedTasks.filter((t) => t.date === selectedDateVal);
    }
  }

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
      {/* HEADER WITH OFFLINE PILL */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        {isOffline && (
          <View style={styles.offlinePill}>
            <Ionicons name="cloud-offline" size={12} color="#EF4444" />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        )}
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingBottom: 15,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -1,
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
