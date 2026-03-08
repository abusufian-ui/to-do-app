import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
    danger: "#EF4444",
    brand: "#3B82F6",
    success: "#10B981",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
    danger: "#F87171",
    brand: "#60A5FA",
    success: "#34D399",
  },
};

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
  const [timetable, setTimetable] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [statusSheetTask, setStatusSheetTask] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const renderCourseIcon = (
    courseName: string,
    size = 16,
    color = theme.subtext,
  ) => {
    if (!courseName || courseName === "General")
      return <Ionicons name="book" size={size} color={color} />;
    if (courseName === "Event")
      return <Ionicons name="calendar" size={size} color={theme.danger} />;

    const isUni = courses.some(
      (c: any) =>
        (c.type === "university" || c.type === "uni") && c.name === courseName,
    );
    if (isUni)
      return (
        <UCPLogo
          width={size}
          height={size}
          color={
            color === theme.subtext && theme === Colors.dark
              ? "#A3A3A3"
              : theme.text
          }
        />
      );

    return <Ionicons name="book" size={size} color={color} />;
  };

  const showToast = (
    msg: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ visible: true, msg, type });
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToast({ visible: false, msg: "", type: "info" }));
    }, 3000);
  };

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

  const loadDataAndSync = async () => {
    try {
      const [cTasks, cCourses, cTimetable, cQueue] = await Promise.all([
        AsyncStorage.getItem("off_tasks_data"),
        AsyncStorage.getItem("off_tasks_courses"),
        AsyncStorage.getItem("off_timetable_data"),
        AsyncStorage.getItem("tasks_sync_queue"),
      ]);
      let currentQueue = cQueue ? JSON.parse(cQueue) : [];
      setSyncQueue(currentQueue);

      const offlineAdds = currentQueue
        .filter((q: any) => q.type === "ADD" && q.endpoint === "/tasks")
        .map((q: any) => ({
          ...q.payload,
          _id: q.id,
          isUnsynced: true,
          createdAt: new Date().toISOString(),
        }));

      if (cTasks) {
        const mergedCache = [...JSON.parse(cTasks), ...offlineAdds];
        setTasks(mergedCache);
      }

      if (cCourses) setCourses(JSON.parse(cCourses));
      if (cTimetable) setTimetable(JSON.parse(cTimetable));
      if (cTasks || cCourses) setIsLoading(false);

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) return setIsLoading(false);

      if (currentQueue.length > 0) {
        currentQueue = await flushQueue(currentQueue, token, BACKEND_URL);
      }

      const config = { headers: { "x-auth-token": token }, timeout: 5000 };
      const [taskRes, courseRes, ttRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/tasks`, config),
        axios.get(`${BACKEND_URL}/courses`, config),
        axios.get(`${BACKEND_URL}/timetable`, config),
      ]);

      setIsOffline(false);
      const remainingOfflineAdds = currentQueue
        .filter((q: any) => q.type === "ADD" && q.endpoint === "/tasks")
        .map((q: any) => ({ ...q.payload, _id: q.id, isUnsynced: true }));

      const mergedFresh = [...taskRes.data, ...remainingOfflineAdds];
      setTasks(mergedFresh);

      setCourses(courseRes.data);
      setTimetable(ttRes.data);
      AsyncStorage.setItem("off_tasks_data", JSON.stringify(taskRes.data));
      AsyncStorage.setItem("off_tasks_courses", JSON.stringify(courseRes.data));
      AsyncStorage.setItem("off_timetable_data", JSON.stringify(ttRes.data));
    } catch (error) {
      setIsOffline(true);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const flushQueue = async (queue: any[], token: string, baseUrl: string) => {
    let remainingQueue = [...queue];
    for (const action of queue) {
      try {
        if (action.type === "DELETE") {
          await axios.put(
            `${baseUrl}/tasks/${action.taskId}/delete`,
            {},
            { headers: { "x-auth-token": token } },
          );
        } else if (action.type === "UPDATE") {
          await axios.put(`${baseUrl}/tasks/${action.taskId}`, action.payload, {
            headers: { "x-auth-token": token },
          });
        } else if (action.type === "ADD") {
          await axios.post(`${baseUrl}${action.endpoint}`, action.payload, {
            headers: { "x-auth-token": token },
          });
        }
        remainingQueue = remainingQueue.filter((a) => a.id !== action.id);
      } catch (error) {
        break;
      }
    }
    await AsyncStorage.setItem(
      "tasks_sync_queue",
      JSON.stringify(remainingQueue),
    );
    setSyncQueue(remainingQueue);
    return remainingQueue;
  };

  const queueBulkActions = async (actions: any[]) => {
    const existingQueue = await AsyncStorage.getItem("tasks_sync_queue");
    const currentQueue = existingQueue ? JSON.parse(existingQueue) : [];
    const newQueue = [...currentQueue, ...actions];
    setSyncQueue(newQueue);
    await AsyncStorage.setItem("tasks_sync_queue", JSON.stringify(newQueue));
    if (!isOffline) loadDataAndSync();
  };

  const queueAction = async (
    type: "UPDATE" | "DELETE",
    taskId: string,
    payload?: any,
  ) => {
    await queueBulkActions([
      { id: Date.now().toString() + Math.random(), type, taskId, payload },
    ]);
  };

  useEffect(() => {
    loadDataAndSync();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDataAndSync();
  };

  const updateTaskLocally = (taskId: string, updateData: any) => {
    if (taskId.toString().includes(".")) return;
    const updatedTasks = tasks.map((t) =>
      t._id === taskId ? { ...t, ...updateData, isUnsynced: true } : t,
    );
    setTasks(updatedTasks);
    AsyncStorage.setItem(
      "off_tasks_data",
      JSON.stringify(updatedTasks.filter((t) => !t.isUnsynced)),
    );
    queueAction("UPDATE", taskId, updateData);
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTaskLocally(taskId, {
      status: newStatus,
      completed: newStatus === "Completed",
    });
    setStatusSheetTask(null);
  };

  const toggleSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const deleteSelectedTasks = () => {
    setConfirmDialog({
      visible: true,
      title: "Delete Tasks",
      message: `Move ${selectedTaskIds.length} selected tasks to the bin?`,
      onConfirm: async () => {
        const remainingTasks = tasks.filter(
          (t) => !selectedTaskIds.includes(t._id),
        );
        setTasks(remainingTasks);
        AsyncStorage.setItem("off_tasks_data", JSON.stringify(remainingTasks));
        const deleteActions = selectedTaskIds.map((id) => ({
          id: Date.now().toString() + Math.random(),
          type: "DELETE",
          taskId: id,
        }));
        await queueBulkActions(deleteActions);

        setIsSelectionMode(false);
        setSelectedTaskIds([]);
        setConfirmDialog(null);
        showToast(`${deleteActions.length} tasks moved to Bin`, "success");
      },
    });
  };

  const getClassesForDate = (dateString: string, courseName: string) => {
    if (
      !dateString ||
      !timetable.length ||
      !courseName ||
      courseName === "General"
    )
      return [];
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const targetDay = days[new Date(dateString).getDay()];
    return timetable.filter(
      (t) =>
        t.day === targetDay &&
        (t.courseName === courseName || t.name === courseName),
    );
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
    const isSelected = selectedTaskIds.includes(task._id);

    return (
      <TouchableOpacity
        key={task._id}
        activeOpacity={0.7}
        onLongPress={() => {
          setIsSelectionMode(true);
          toggleSelection(task._id);
        }}
        onPress={() => {
          if (isSelectionMode) {
            toggleSelection(task._id);
          } else {
            setSelectedTask(task);
            setIsEditingTask(false);
          }
        }}
        style={[
          styles.taskCard,
          task.status === "Completed" && styles.taskCardCompleted,
          isSelected && {
            borderColor: theme.brand,
            backgroundColor: theme.brand + "10",
          },
        ]}
      >
        <View style={styles.taskHeader}>
          {isSelectionMode && (
            <Ionicons
              name={isSelected ? "checkbox" : "square-outline"}
              size={24}
              color={isSelected ? theme.brand : theme.subtext}
              style={{ marginRight: 12 }}
            />
          )}
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
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => !isSelectionMode && setStatusSheetTask(task)}
              style={styles.statusBadge}
            >
              <Ionicons
                name={status.icon as any}
                size={12}
                color={status.color}
              />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </TouchableOpacity>
            {task.isUnsynced && (
              <View style={styles.unsyncedBadge}>
                <Ionicons name="cloud-offline" size={10} color={theme.danger} />
                <Text
                  style={{
                    fontSize: 8,
                    color: theme.danger,
                    fontWeight: "bold",
                  }}
                >
                  UNSYNCED
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.metaContainer}>
          <View style={styles.metaPill}>
            {renderCourseIcon(task.course, 12, theme.subtext)}
            <Text style={styles.metaText} numberOfLines={1}>
              {task.course || "General"}
            </Text>
          </View>
          {(task.date || task.time) && (
            <View style={styles.metaPill}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={theme.subtext}
              />
              <Text style={styles.metaText}>
                {formatDate(task.date)} {task.time ? `• ${task.time}` : ""}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const isHeaderActive = isSelectionMode || isOffline || syncQueue.length > 0;

  return (
    <View style={styles.container}>
      {toast.visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              backgroundColor:
                toast.type === "error"
                  ? theme.danger
                  : toast.type === "info"
                    ? theme.brand
                    : theme.success,
            },
          ]}
        >
          <Ionicons
            name={
              toast.type === "success"
                ? "checkmark-circle"
                : toast.type === "error"
                  ? "alert-circle"
                  : "information-circle"
            }
            size={20}
            color="#FFF"
          />
          <Text style={styles.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}

      <Modal visible={!!confirmDialog} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>{confirmDialog?.title}</Text>
            <Text style={styles.confirmMessage}>{confirmDialog?.message}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                onPress={() => setConfirmDialog(null)}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDialog?.onConfirm}
                style={styles.confirmDeleteBtn}
              >
                <Text style={styles.confirmDeleteText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- COLLAPSIBLE HEADER (FIXES BLANK SPACE) --- */}
      <View style={[styles.header, !isHeaderActive && { display: "none" }]}>
        <Text style={styles.headerTitle}>
          {isSelectionMode ? `${selectedTaskIds.length} Selected` : ""}
        </Text>

        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          {isSelectionMode ? (
            <TouchableOpacity
              onPress={() => {
                setIsSelectionMode(false);
                setSelectedTaskIds([]);
              }}
            >
              <Text
                style={{ color: theme.brand, fontWeight: "bold", fontSize: 16 }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          ) : isOffline ? (
            <View style={styles.offlinePill}>
              <Ionicons name="cloud-offline" size={12} color={theme.danger} />
              <Text
                style={{ color: theme.danger, fontSize: 11, fontWeight: "800" }}
              >
                Offline Mode
              </Text>
            </View>
          ) : syncQueue.length > 0 ? (
            <ActivityIndicator size="small" color={theme.brand} />
          ) : null}
        </View>
      </View>

      <View style={[styles.tabContainer, !isHeaderActive && { marginTop: 15 }]}>
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
          {dateFilters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              onPress={() => setSelectedDateFilter(filter.id)}
              style={[
                styles.datePill,
                selectedDateFilter === filter.id && styles.activeDatePill,
              ]}
            >
              <Text
                style={[
                  styles.datePillText,
                  selectedDateFilter === filter.id && styles.activeDatePillText,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
          />
        }
      >
        {displayedTasks.map(renderTask)}
      </ScrollView>

      {isSelectionMode && selectedTaskIds.length > 0 && (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteSelectedTasks}
          >
            <Ionicons name="trash" size={20} color="#FFF" />
            <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>
              Delete Selected
            </Text>
          </TouchableOpacity>
        </View>
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
                    return (
                      <TouchableOpacity
                        key={status}
                        style={styles.sheetRow}
                        onPress={() =>
                          handleStatusChange(statusSheetTask._id, status)
                        }
                      >
                        <Ionicons
                          name={sConf.icon as any}
                          size={20}
                          color={sConf.color}
                        />
                        <Text style={styles.sheetText}>{status}</Text>
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
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  flex: 1,
                }}
              >
                <View style={styles.headerIconBg}>
                  <Ionicons
                    name={isEditingTask ? "create" : "document-text"}
                    size={24}
                    color={theme.brand}
                  />
                </View>
                <Text style={styles.fullModalTitle}>
                  {isEditingTask ? "Edit Task" : "Task Summary"}
                </Text>
              </View>

              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                {isEditingTask ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingTask(false)}
                    style={styles.doneBtn}
                  >
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setIsEditingTask(true)}
                    style={styles.editIconBtn}
                  >
                    <Ionicons
                      name="create-outline"
                      size={22}
                      color={theme.text}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTask(null);
                    setIsEditingTask(false);
                  }}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={24} color={theme.subtext} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24 }}
            >
              {!isEditingTask ? (
                <View>
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
                        "No additional notes provided."}
                    </Text>
                  </View>

                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryGridItem, { width: "100%" }]}>
                      <Text style={styles.gridLabel}>Course</Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 6,
                          marginTop: 4,
                        }}
                      >
                        <View style={{ marginTop: 2 }}>
                          {/* Micro-adjustment to align icon with text baseline */}
                          {/* DYNAMIC UCP ICON INJECTED HERE */}
                          {renderCourseIcon(
                            selectedTask?.course,
                            14,
                            theme.subtext,
                          )}
                        </View>
                        <Text
                          style={[
                            styles.gridValue,
                            { flexShrink: 1, marginTop: 0 },
                          ]}
                        >
                          {selectedTask?.course || "General"}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.summaryGridItem, { width: "100%" }]}>
                      <Text style={styles.gridLabel}>Date & Time</Text>
                      <Text style={styles.gridValue}>
                        {formatDate(selectedTask?.date)}{" "}
                        {selectedTask?.time ? `• ${selectedTask?.time}` : ""}
                      </Text>
                    </View>

                    <View style={styles.summaryGridItem}>
                      <Text style={styles.gridLabel}>Priority</Text>
                      <Text
                        style={[
                          styles.gridValue,
                          {
                            color: getPriorityConfig(selectedTask?.priority)
                              .color,
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
                          {
                            color: getStatusConfig(selectedTask?.status).color,
                          },
                        ]}
                      >
                        {selectedTask?.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.gridLabel}>Task Title</Text>
                  <TextInput
                    style={styles.editTitleInput}
                    value={selectedTask?.name}
                    onChangeText={(t) =>
                      setSelectedTask({ ...selectedTask, name: t })
                    }
                    onBlur={() =>
                      updateTaskLocally(selectedTask._id, {
                        name: selectedTask.name,
                      })
                    }
                    multiline
                  />
                  <Text style={styles.gridLabel}>Description</Text>
                  <TextInput
                    style={styles.editDescInput}
                    value={selectedTask?.description}
                    placeholder="Add notes..."
                    placeholderTextColor={theme.subtext}
                    onChangeText={(t) =>
                      setSelectedTask({ ...selectedTask, description: t })
                    }
                    onBlur={() =>
                      updateTaskLocally(selectedTask._id, {
                        description: selectedTask.description,
                      })
                    }
                    multiline
                  />
                  <Text style={styles.gridLabel}>Priority</Text>
                  <View style={styles.priorityRow}>
                    {["Low", "Medium", "High", "Critical"].map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.chipBtn,
                          selectedTask?.priority === p && {
                            borderColor: theme.brand,
                            backgroundColor: theme.brand + "15",
                          },
                        ]}
                        onPress={() => {
                          setSelectedTask({ ...selectedTask, priority: p });
                          updateTaskLocally(selectedTask._id, { priority: p });
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedTask?.priority === p && {
                              color: theme.brand,
                            },
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      marginTop: 10,
                      marginBottom: 20,
                    }}
                  >
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar" size={16} color={theme.brand} />
                      <Text style={{ color: theme.brand, fontWeight: "bold" }}>
                        {selectedTask?.date
                          ? formatDate(selectedTask.date)
                          : "Set Date"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Ionicons name="time" size={16} color={theme.brand} />
                      <Text style={{ color: theme.brand, fontWeight: "bold" }}>
                        {selectedTask?.time || "Set Time"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedTask?.date &&
                    getClassesForDate(selectedTask.date, selectedTask.course)
                      .length > 0 && (
                      <View style={{ marginBottom: 24 }}>
                        <Text
                          style={[
                            styles.gridLabel,
                            { marginBottom: 8, color: theme.brand },
                          ]}
                        >
                          ✨ Link to a class on this day?
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          {getClassesForDate(
                            selectedTask.date,
                            selectedTask.course,
                          ).map((cls: any, idx: number) => (
                            <TouchableOpacity
                              key={idx}
                              style={styles.suggestionPill}
                              onPress={() => {
                                const updated = {
                                  ...selectedTask,
                                  course: cls.courseName,
                                  time: cls.startTime,
                                };
                                setSelectedTask(updated);
                                updateTaskLocally(selectedTask._id, {
                                  course: cls.courseName,
                                  time: cls.startTime,
                                });
                                showToast("Class Linked!", "info");
                              }}
                            >
                              <Text style={styles.suggestionTitle}>
                                {cls.courseName}
                              </Text>
                              <Text style={styles.suggestionTime}>
                                {cls.startTime} - {cls.room}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={
              selectedTask?.date ? new Date(selectedTask.date) : new Date()
            }
            mode="date"
            onChange={(e, d) => {
              setShowDatePicker(Platform.OS === "ios");
              if (d) {
                const strDate = getLocalYYYYMMDD(d);
                setSelectedTask({ ...selectedTask, date: strDate });
                updateTaskLocally(selectedTask._id, { date: strDate });
              }
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            onChange={(e, t) => {
              setShowTimePicker(Platform.OS === "ios");
              if (t) {
                const strTime = t.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                setSelectedTask({ ...selectedTask, time: strTime });
                updateTaskLocally(selectedTask._id, { time: strTime });
              }
            }}
          />
        )}
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
      backgroundColor: theme.danger + "20",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
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
    scrollContent: { paddingHorizontal: 24, paddingBottom: 120, gap: 12 },
    taskCard: {
      backgroundColor: theme.card,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    taskCardCompleted: { opacity: 0.6, backgroundColor: theme.background },
    taskHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
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
    unsyncedBadge: {
      flexDirection: "row",
      gap: 4,
      alignItems: "center",
      backgroundColor: theme.danger + "10",
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 8,
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
    selectionBar: {
      position: "absolute",
      bottom: 30,
      left: 24,
      right: 24,
      backgroundColor: theme.danger,
      borderRadius: 20,
      elevation: 10,
      shadowColor: theme.danger,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
    },
    deleteButton: {
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
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
      paddingBottom: 40,
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
    },
    closeBtn: {
      padding: 4,
      backgroundColor: theme.background,
      borderRadius: 20,
    },
    editIconBtn: { padding: 8, borderRadius: 20 },
    doneBtn: {
      backgroundColor: theme.brand + "15",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brand + "40",
    },
    doneBtnText: { color: theme.brand, fontWeight: "800", fontSize: 13 },
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
    gridValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
      marginTop: 4,
    },
    editTitleInput: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: 10,
      marginBottom: 16,
    },
    editDescInput: {
      fontSize: 15,
      color: theme.text,
      backgroundColor: theme.background,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 80,
      textAlignVertical: "top",
      marginBottom: 16,
    },
    priorityRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 20,
      marginTop: 4,
    },
    chipBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    chipText: { fontSize: 12, fontWeight: "700", color: theme.subtext },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.brand + "15",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brand + "40",
    },
    suggestionPill: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.brand + "50",
      padding: 12,
      borderRadius: 14,
      marginRight: 10,
      minWidth: 140,
    },
    suggestionTitle: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 13,
      marginBottom: 4,
    },
    suggestionTime: { color: theme.subtext, fontSize: 11 },
    gridLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.subtext,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 4,
    },
    toastContainer: {
      position: "absolute",
      top: 60,
      left: 24,
      right: 24,
      padding: 16,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      zIndex: 9999,
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 5,
    },
    toastText: { color: "#FFF", fontWeight: "bold", fontSize: 14, flex: 1 },
    modalOverlayCenter: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    confirmDialog: {
      backgroundColor: theme.card,
      width: "100%",
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    confirmTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    confirmMessage: {
      fontSize: 15,
      color: theme.subtext,
      lineHeight: 22,
      marginBottom: 24,
    },
    confirmActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
    },
    confirmCancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.background,
    },
    confirmCancelText: { color: theme.subtext, fontWeight: "bold" },
    confirmDeleteBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.danger,
    },
    confirmDeleteText: { color: "#FFF", fontWeight: "bold" },
  });
