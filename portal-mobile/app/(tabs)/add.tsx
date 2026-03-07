import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import React, { ComponentProps, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

import UCPLogo from "../../components/UCPLogo";

const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
    border: "#E5E5E5",
    card: "#FAFAFA",
    brand: "#3B82F6",
    danger: "#F43F5E",
    success: "#10B981",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    brand: "#60A5FA",
    danger: "#FB7185",
    success: "#34D399",
  },
};

type TabItem = {
  id: "transaction" | "task" | "note";
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
};
const TAB_DATA: TabItem[] = [
  { id: "transaction", icon: "wallet-outline", label: "Cash" },
  { id: "task", icon: "checkbox-outline", label: "Task" },
  { id: "note", icon: "bulb-outline", label: "Snaps" },
];
const EXPENSE_CATEGORIES = [
  { id: "Food & Dining", icon: "restaurant-outline" },
  { id: "Transportation", icon: "car-outline" },
  { id: "Shopping", icon: "cart-outline" },
  { id: "Education", icon: "book-outline" },
  { id: "Bills & Utilities", icon: "flash-outline" },
  { id: "Entertainment", icon: "game-controller-outline" },
  { id: "Other", icon: "gift-outline" },
];
const INCOME_CATEGORIES = [
  { id: "Salary", icon: "cash-outline" },
  { id: "Freelance", icon: "laptop-outline" },
  { id: "Investments", icon: "trending-up-outline" },
  { id: "Gifts & Grants", icon: "gift-outline" },
  { id: "Other Income", icon: "add-outline" },
];

const getLocalYYYYMMDD = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function AddScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [activeTab, setActiveTab] = useState<"transaction" | "task" | "note">(
    "transaction",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [showCourseList, setShowCourseList] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });

  const [showTDatePicker, setShowTDatePicker] = useState(false);
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [showTaskTimePicker, setShowTaskTimePicker] = useState(false);
  const [tDateObj, setTDateObj] = useState(new Date());
  const [taskDateObj, setTaskDateObj] = useState(new Date());
  const [taskTimeObj, setTaskTimeObj] = useState(new Date());

  const [tType, setTType] = useState<"expense" | "income">("expense");
  const [tAmount, setTAmount] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tCategory, setTCategory] = useState("Food & Dining");
  const [tDate, setTDate] = useState(new Date().toISOString().split("T")[0]);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskStatus, setTaskStatus] = useState("New task");
  const [taskCourse, setTaskCourse] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskDesc, setTaskDesc] = useState("");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteCourse, setNoteCourse] = useState("");
  const [showNoteCourseList, setShowNoteCourseList] = useState(false);

  // --- MULTIPLE MEDIA STATES ---
  const [mediaFiles, setMediaFiles] = useState<
    { uri: string; type: "image" | "audio" }[]
  >([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | undefined>();

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
    }, 3500);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // THE FIX: Use standard cache keys to ensure data is available instantly
        const [cCourses, cTime] = await Promise.all([
          AsyncStorage.getItem("off_acad_courses"),
          AsyncStorage.getItem("off_acad_time"),
        ]);
        if (cCourses) setCourses(JSON.parse(cCourses));
        if (cTime) setTimetable(JSON.parse(cTime));

        const token = await AsyncStorage.getItem("userToken");
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!token || !BACKEND_URL) return;

        const [courseRes, timeRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/courses`, {
            headers: { "x-auth-token": token },
          }),
          axios.get(`${BACKEND_URL}/timetable`, {
            headers: { "x-auth-token": token },
          }),
        ]);

        const freshCourses = Array.isArray(courseRes.data)
          ? courseRes.data
          : [];
        const freshTime = Array.isArray(timeRes.data) ? timeRes.data : [];

        setCourses(freshCourses);
        setTimetable(freshTime);

        AsyncStorage.setItem("off_acad_courses", JSON.stringify(freshCourses));
        AsyncStorage.setItem("off_acad_time", JSON.stringify(freshTime));
      } catch (error) {
        console.log("Failed to load initial data");
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    setTCategory(tType === "expense" ? "Food & Dining" : "Salary");
  }, [tType]);

  // THE FIX: Indestructible Timezone-Safe Course Matcher
  const getClassesForDate = (dateString: string, courseName: string) => {
    if (
      !dateString ||
      !timetable ||
      !timetable.length ||
      !courseName ||
      courseName === "General"
    ) {
      return [];
    }

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    let targetDay = "";

    // Prevent UTC Midnight Shifting
    if (dateString.includes("-")) {
      const [y, m, d] = dateString.split("-");
      const localDate = new Date(Number(y), Number(m) - 1, Number(d));
      targetDay = days[localDate.getDay()];
    } else {
      targetDay = days[new Date(dateString).getDay()];
    }

    return timetable.filter((t) => {
      const tDay = String(t.day || "")
        .trim()
        .toLowerCase();
      const tCourseName = String(t.courseName || t.name || "")
        .trim()
        .toLowerCase();
      const selectedCourseName = String(courseName).trim().toLowerCase();

      return (
        tDay === targetDay.toLowerCase() && tCourseName === selectedCourseName
      );
    });
  };

  const uniCourses = courses.filter(
    (c) => c.type === "university" || c.type === "uni",
  );
  const generalCourses = courses.filter(
    (c) => c.type !== "university" && c.type !== "uni",
  );

  const renderCourseIcon = (courseName: string, size = 16) => {
    if (courseName === "Event")
      return <Ionicons name="calendar" size={size} color={theme.danger} />;
    const isUni = uniCourses.some((c) => c.name === courseName);
    if (isUni) return <UCPLogo width={size} height={size} color={theme.text} />;
    return <Ionicons name="book-outline" size={size} color={theme.subtext} />;
  };

  const getStatusIcon = (s: string): any => {
    switch (s) {
      case "Scheduled":
        return "calendar-outline";
      case "In Progress":
        return "time-outline";
      case "Completed":
        return "checkmark-circle-outline";
      default:
        return "mail-outline";
    }
  };
  const getPriorityIcon = (p: string): any => {
    switch (p) {
      case "Critical":
        return "warning-outline";
      case "High":
        return "chevron-up-outline";
      case "Low":
        return "arrow-down-outline";
      default:
        return "remove-outline";
    }
  };

  const onTDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowTDatePicker(false);
    if (selectedDate) {
      setTDateObj(selectedDate);
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - offset * 60 * 1000);
      setTDate(localDate.toISOString().split("T")[0]);
    }
  };

  const onTaskDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowTaskDatePicker(false);
    if (selectedDate) {
      setTaskDateObj(selectedDate);
      setTaskDate(getLocalYYYYMMDD(selectedDate));
    }
  };

  const onTaskTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTaskTimePicker(false);
    if (selectedTime) {
      setTaskTimeObj(selectedTime);
      setTaskTime(
        selectedTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  };

  const handleSnap = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted")
      return showToast("Camera access is required.", "error");
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled) {
      setMediaFiles((prev) => [
        ...prev,
        { uri: result.assets[0].uri, type: "image" },
      ]);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted")
      return showToast("Gallery access is required.", "error");
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const newFiles = result.assets.map((a) => ({
        uri: a.uri,
        type: "image" as const,
      }));
      setMediaFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) setMediaFiles((prev) => [...prev, { uri, type: "audio" }]);
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setRecording(newRecording);
        setIsRecording(true);
      } catch (err) {
        showToast("Failed to start recording", "error");
      }
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!token || !BACKEND_URL)
        return showToast("Authentication missing.", "error");
      const headers = {
        "x-auth-token": token,
        "Content-Type": "application/json",
      };

      if (activeTab === "transaction") {
        if (!tAmount || !tDesc)
          return showToast("Please enter amount and description.", "error");
        const payload = {
          type: tType,
          amount: Number(tAmount),
          category: tCategory,
          description: tDesc,
          date: tDate,
        };
        try {
          await axios.post(`${BACKEND_URL}/transactions`, payload, { headers });
          showToast("Cash logged successfully!", "success");
        } catch (e) {
          saveOfflineQueue("ADD", "/transactions", payload);
        }
      } else if (activeTab === "task") {
        if (!taskTitle) return showToast("Task Title is required.", "error");
        const payload = {
          name: taskTitle,
          description: taskDesc,
          course: taskCourse || "General",
          date: taskDate,
          time: taskTime || null,
          priority: taskPriority,
          status: taskStatus,
          subTasks: [],
        };
        try {
          await axios.post(`${BACKEND_URL}/tasks`, payload, { headers });
          showToast("Task created successfully!", "success");
        } catch (e) {
          saveOfflineQueue("ADD", "/tasks", payload);
        }
      } else if (activeTab === "note") {
        if (!noteTitle)
          return showToast("Please give your snap a title.", "error");
        if (!noteBody && mediaFiles.length === 0)
          return showToast(
            "Please add a description or attach media.",
            "error",
          );

        let finalMediaUrls: string[] = [];

        if (mediaFiles.length > 0) {
          const formData = new FormData();

          mediaFiles.forEach((media, index) => {
            const filename = media.uri.split("/").pop() || `media_${index}.jpg`;
            const match = /\.(\w+)$/.exec(filename);

            const ext = match
              ? match[1].toLowerCase()
              : media.type === "audio"
                ? "m4a"
                : "jpg";

            let mime = media.type === "audio" ? `audio/${ext}` : `image/${ext}`;
            if (ext === "m4a") mime = "audio/mp4";
            if (ext === "jpg") mime = "image/jpeg";

            formData.append("files", {
              uri:
                Platform.OS === "ios"
                  ? media.uri.replace("file://", "")
                  : media.uri,
              name: filename,
              type: mime,
            } as any);
          });

          try {
            const uploadRes = await fetch(`${BACKEND_URL}/upload`, {
              method: "POST",
              headers: { "x-auth-token": token },
              body: formData,
            });

            if (!uploadRes.ok) throw new Error("Upload failed");

            const uploadData = await uploadRes.json();
            if (uploadData.urls) {
              finalMediaUrls = uploadData.urls;
            }
          } catch (uploadError) {
            setIsSaving(false);
            return showToast("Could not upload media to the server.", "error");
          }
        }

        let overallType = "text";
        if (mediaFiles.length > 0) {
          const hasImages = mediaFiles.some((m) => m.type === "image");
          const hasAudio = mediaFiles.some((m) => m.type === "audio");
          if (hasImages && hasAudio) overallType = "mixed";
          else if (hasImages) overallType = "image";
          else if (hasAudio) overallType = "audio";
        }

        const payload = {
          title: noteTitle,
          courseName: noteCourse || "General",
          type: overallType,
          content: noteBody,
          mediaUrls: finalMediaUrls,
        };

        try {
          await axios.post(`${BACKEND_URL}/keynotes`, payload, { headers });
          showToast("Snap saved to Inbox!", "success");
        } catch (e) {
          saveOfflineQueue("ADD", "/keynotes", payload);
        }
      }

      setTAmount("");
      setTDesc("");
      setTaskTitle("");
      setTaskCourse("");
      setTaskDate("");
      setTaskTime("");
      setTaskDesc("");
      setNoteTitle("");
      setNoteBody("");
      setNoteCourse("");
      setMediaFiles([]);
    } catch (error) {
      showToast("Failed to process data.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const saveOfflineQueue = async (
    type: string,
    endpoint: string,
    payload: any,
  ) => {
    const existingQueue = await AsyncStorage.getItem("tasks_sync_queue");
    const queue = existingQueue ? JSON.parse(existingQueue) : [];
    queue.push({ id: Date.now().toString(), type, endpoint, payload });
    await AsyncStorage.setItem("tasks_sync_queue", JSON.stringify(queue));
    showToast("No internet. Saved to offline queue.", "info");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
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
                  : "cloud-offline"
            }
            size={20}
            color="#FFF"
          />
          <Text style={styles.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.typeSelector}>
          {TAB_DATA.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.typeTab,
                activeTab === tab.id && {
                  borderBottomColor: theme.brand,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={20}
                color={activeTab === tab.id ? theme.brand : theme.subtext}
              />
              <Text
                style={[
                  styles.typeTabText,
                  activeTab === tab.id && {
                    color: theme.brand,
                    fontWeight: "800",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "transaction" && (
          <View style={styles.formContainer}>
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  tType === "expense" && {
                    backgroundColor: theme.danger + "20",
                    borderColor: theme.danger,
                  },
                ]}
                onPress={() => setTType("expense")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    tType === "expense" && { color: theme.danger },
                  ]}
                >
                  Spent Money
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  tType === "income" && {
                    backgroundColor: theme.success + "20",
                    borderColor: theme.success,
                  },
                ]}
                onPress={() => setTType("income")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    tType === "income" && { color: theme.success },
                  ]}
                >
                  Got Paid
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Amount (PKR)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={theme.subtext}
                  value={tAmount}
                  onChangeText={setTAmount}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowTDatePicker(true)}
                >
                  <Text style={{ color: tDate ? theme.text : theme.subtext }}>
                    {tDate || "Select Date"}
                  </Text>
                </TouchableOpacity>
                {showTDatePicker && (
                  <DateTimePicker
                    value={tDateObj}
                    mode="date"
                    display="default"
                    onChange={onTDateChange}
                  />
                )}
              </View>
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.gridContainer}>
              {(tType === "expense"
                ? EXPENSE_CATEGORIES
                : INCOME_CATEGORIES
              ).map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.gridItem,
                    tCategory === cat.id && {
                      borderColor:
                        tType === "expense" ? theme.brand : theme.success,
                      backgroundColor:
                        tType === "expense"
                          ? theme.brand + "15"
                          : theme.success + "15",
                    },
                  ]}
                  onPress={() => setTCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={20}
                    color={
                      tCategory === cat.id
                        ? tType === "expense"
                          ? theme.brand
                          : theme.success
                        : theme.subtext
                    }
                  />
                  <Text
                    style={[
                      styles.gridItemText,
                      tCategory === cat.id && {
                        color:
                          tType === "expense" ? theme.brand : theme.success,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {cat.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="What was this for?"
              placeholderTextColor={theme.subtext}
              value={tDesc}
              onChangeText={setTDesc}
            />
          </View>
        )}

        {activeTab === "task" && (
          <View style={styles.formContainer}>
            <Text style={styles.label}>Task Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Prepare for OS Quiz"
              placeholderTextColor={theme.subtext}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            <Text style={styles.label}>Status</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {["New task", "Scheduled", "In Progress", "Completed"].map(
                (s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chipBtn,
                      { flexDirection: "row", gap: 6 },
                      taskStatus === s && styles.chipBtnActive,
                    ]}
                    onPress={() => setTaskStatus(s)}
                  >
                    <Ionicons
                      name={getStatusIcon(s)}
                      size={16}
                      color={taskStatus === s ? theme.brand : theme.subtext}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        taskStatus === s && { color: theme.brand },
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>

            <View>
              <Text style={styles.label}>Course</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setShowCourseList(!showCourseList)}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  {taskCourse ? (
                    renderCourseIcon(taskCourse, 18)
                  ) : (
                    <Ionicons
                      name="book-outline"
                      size={18}
                      color={theme.subtext}
                    />
                  )}
                  <Text
                    style={{
                      color: taskCourse ? theme.text : theme.subtext,
                      fontWeight: taskCourse ? "600" : "400",
                    }}
                  >
                    {taskCourse || "Select Course"}
                  </Text>
                </View>
                <Ionicons
                  name={showCourseList ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.subtext}
                />
              </TouchableOpacity>

              {showCourseList && (
                <View style={styles.dropdownList}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setTaskCourse("Event");
                      setShowCourseList(false);
                    }}
                  >
                    {renderCourseIcon("Event", 16)}
                    <Text
                      style={[styles.dropdownItemText, { color: theme.danger }]}
                    >
                      Event
                    </Text>
                  </TouchableOpacity>
                  {uniCourses.length > 0 && (
                    <Text style={styles.dropdownSection}>
                      UNIVERSITY COURSES
                    </Text>
                  )}
                  {uniCourses.map((c) => (
                    <TouchableOpacity
                      key={c._id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setTaskCourse(c.name);
                        setShowCourseList(false);
                      }}
                    >
                      {renderCourseIcon(c.name, 16)}
                      <Text style={styles.dropdownItemText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.dropdownSection}>GENERAL</Text>
                  {generalCourses.map((c) => (
                    <TouchableOpacity
                      key={c._id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setTaskCourse(c.name);
                        setShowCourseList(false);
                      }}
                    >
                      {renderCourseIcon(c.name, 16)}
                      <Text style={styles.dropdownItemText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Due Date</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowTaskDatePicker(true)}
                >
                  <Text
                    style={{ color: taskDate ? theme.text : theme.subtext }}
                  >
                    {taskDate || "Select Date"}
                  </Text>
                </TouchableOpacity>
                {showTaskDatePicker && (
                  <DateTimePicker
                    value={taskDateObj}
                    mode="date"
                    display="default"
                    onChange={onTaskDateChange}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowTaskTimePicker(true)}
                >
                  <Text
                    style={{ color: taskTime ? theme.text : theme.subtext }}
                  >
                    {taskTime || "Select Time"}
                  </Text>
                </TouchableOpacity>
                {showTaskTimePicker && (
                  <DateTimePicker
                    value={taskTimeObj}
                    mode="time"
                    display="default"
                    onChange={onTaskTimeChange}
                  />
                )}
              </View>
            </View>

            {/* THE FIX: Enhanced Render Loop for Class Suggestions */}
            {taskDate && getClassesForDate(taskDate, taskCourse).length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.label, { color: theme.brand }]}>
                  ✨ Link to a class on this day?
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  {getClassesForDate(taskDate, taskCourse).map(
                    (cls: any, idx: number) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionPill}
                        onPress={() => {
                          setTaskCourse(cls.courseName || cls.name);
                          setTaskTime(cls.startTime);
                          showToast("Class Linked!", "info");
                        }}
                      >
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {cls.courseName || cls.name}
                        </Text>
                        <Text style={styles.suggestionTime}>
                          {cls.startTime || "TBA"} - {cls.room || "TBA"}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Priority</Text>
            <View style={styles.row}>
              {["Low", "Medium", "High", "Critical"].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.chipBtn,
                    {
                      flex: 1,
                      paddingHorizontal: 0,
                      flexDirection: "row",
                      gap: 4,
                    },
                    taskPriority === p && styles.chipBtnActive,
                  ]}
                  onPress={() => setTaskPriority(p)}
                >
                  <Ionicons
                    name={getPriorityIcon(p)}
                    size={14}
                    color={taskPriority === p ? theme.brand : theme.subtext}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      taskPriority === p && {
                        color: theme.brand,
                        fontSize: 12,
                      },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="Add project details..."
              placeholderTextColor={theme.subtext}
              multiline
              value={taskDesc}
              onChangeText={setTaskDesc}
            />
          </View>
        )}

        {activeTab === "note" && (
          <View style={styles.formContainer}>
            <View>
              <Text style={styles.label}>Link to Course</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setShowNoteCourseList(!showNoteCourseList)}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  {noteCourse ? (
                    renderCourseIcon(noteCourse, 18)
                  ) : (
                    <Ionicons
                      name="book-outline"
                      size={18}
                      color={theme.subtext}
                    />
                  )}
                  <Text
                    style={{
                      color: noteCourse ? theme.text : theme.subtext,
                      fontWeight: noteCourse ? "600" : "400",
                    }}
                  >
                    {noteCourse || "Select Course"}
                  </Text>
                </View>
                <Ionicons
                  name={showNoteCourseList ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.subtext}
                />
              </TouchableOpacity>

              {showNoteCourseList && (
                <View style={styles.dropdownList}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setNoteCourse("Event");
                      setShowNoteCourseList(false);
                    }}
                  >
                    {renderCourseIcon("Event", 16)}
                    <Text
                      style={[styles.dropdownItemText, { color: theme.danger }]}
                    >
                      Event
                    </Text>
                  </TouchableOpacity>
                  {uniCourses.length > 0 && (
                    <Text style={styles.dropdownSection}>
                      UNIVERSITY COURSES
                    </Text>
                  )}
                  {uniCourses.map((c) => (
                    <TouchableOpacity
                      key={c._id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setNoteCourse(c.name);
                        setShowNoteCourseList(false);
                      }}
                    >
                      {renderCourseIcon(c.name, 16)}
                      <Text style={styles.dropdownItemText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.dropdownSection}>GENERAL</Text>
                  {generalCourses.map((c) => (
                    <TouchableOpacity
                      key={c._id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setNoteCourse(c.name);
                        setShowCourseList(false);
                      }}
                    >
                      {renderCourseIcon(c.name, 16)}
                      <Text style={styles.dropdownItemText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.label}>Snap Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Lecture Summary, Quick Idea..."
              placeholderTextColor={theme.subtext}
              value={noteTitle}
              onChangeText={setNoteTitle}
            />

            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              placeholder="Jot down the details here..."
              placeholderTextColor={theme.subtext}
              multiline
              value={noteBody}
              onChangeText={setNoteBody}
            />

            {mediaFiles.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10, paddingBottom: 5 }}
              >
                {mediaFiles.map((media, idx) => (
                  <View key={idx} style={styles.mediaThumbnail}>
                    {media.type === "image" ? (
                      <Image
                        source={{ uri: media.uri }}
                        style={{
                          width: "100%",
                          height: "100%",
                          resizeMode: "cover",
                        }}
                      />
                    ) : (
                      <View style={styles.audioThumbnail}>
                        <Ionicons
                          name="mic-circle"
                          size={36}
                          color={theme.success}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            color: theme.text,
                            marginTop: 4,
                            fontWeight: "700",
                          }}
                        >
                          Voice Note
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => removeMedia(idx)}
                      style={styles.mediaRemoveBtn}
                    >
                      <Ionicons name="trash" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleSnap}>
                <Ionicons name="camera" size={24} color={theme.brand} />
                <Text style={[styles.actionBtnText, { color: theme.brand }]}>
                  Camera
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handlePickImage}
              >
                <Ionicons name="images" size={24} color={theme.brand} />
                <Text style={[styles.actionBtnText, { color: theme.brand }]}>
                  Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  isRecording && {
                    backgroundColor: theme.danger + "20",
                    borderColor: theme.danger,
                  },
                ]}
                onPress={handleRecord}
              >
                <Ionicons
                  name={isRecording ? "stop-circle" : "mic"}
                  size={24}
                  color={isRecording ? theme.danger : theme.brand}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: isRecording ? theme.danger : theme.brand },
                  ]}
                >
                  {isRecording ? "Recording..." : "Voice"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { marginTop: 30 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>
              Save{" "}
              {activeTab === "note"
                ? "Snap"
                : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 10 },
    typeSelector: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 20,
    },
    typeTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      gap: 8,
    },
    typeTabText: { fontSize: 14, fontWeight: "600", color: theme.subtext },
    formContainer: { gap: 14 },
    label: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.subtext,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
      color: theme.text,
      fontSize: 15,
      justifyContent: "center",
    },
    segmentControl: { flexDirection: "row", gap: 10, marginBottom: 4 },
    segmentBtn: {
      flex: 1,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    segmentText: { fontSize: 13, fontWeight: "800", color: theme.subtext },
    row: { flexDirection: "row", gap: 10 },
    chipBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    chipBtnActive: {
      borderColor: theme.brand,
      backgroundColor: theme.brand + "15",
    },
    chipText: { fontSize: 13, fontWeight: "700", color: theme.subtext },
    gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    gridItem: {
      width: "30%",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
      gap: 6,
    },
    gridItemText: {
      fontSize: 10,
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
    },
    dropdownBtn: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
    },
    dropdownList: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      marginTop: 8,
      overflow: "hidden",
    },
    dropdownSection: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
      backgroundColor: theme.border + "50",
    },
    dropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 10,
    },
    dropdownItemText: { fontSize: 14, color: theme.text, fontWeight: "500" },
    saveBtn: {
      backgroundColor: theme.brand,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
    },
    saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
    actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    actionBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.brand + "50",
      backgroundColor: theme.brand + "10",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    actionBtnText: { fontSize: 12, fontWeight: "700" },
    mediaThumbnail: {
      width: 110,
      height: 110,
      borderRadius: 16,
      overflow: "hidden",
      position: "relative",
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 12,
    },
    audioThumbnail: {
      flex: 1,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
    },
    mediaRemoveBtn: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: 6,
      borderRadius: 20,
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
  });
