import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
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
    brand: "#3B82F6",
    brandBg: "rgba(59, 130, 246, 0.1)",
    success: "#10B981", // Added to prevent crashes
    danger: "#EF4444", // Added to prevent crashes
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
    brand: "#3B82F6",
    brandBg: "rgba(59, 130, 246, 0.1)",
    success: "#10B981", // Added to prevent crashes
    danger: "#EF4444", // Added to prevent crashes
  },
};

const stripHtml = (html: string) => {
  if (!html) return "";
  let text = html.replace(/<br\s*[\/]?>/gi, "\n");
  text = text.replace(/<\/(div|p|h1|h2|h3|h4|h5|h6|li)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return text.trim();
};

const getReadTime = (text: string) => {
  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
};

const generateHtml = (content: string, themeMode: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>
    :root { color-scheme: ${themeMode}; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
      padding: 0 20px 40px 20px;
      margin: 0;
      font-size: 17px; 
      line-height: 1.6;
      color: ${themeMode === "dark" ? "#E5E5E5" : "#111827"}; 
      background-color: ${themeMode === "dark" ? "#000000" : "#FFFFFF"}; 
      word-wrap: break-word; 
    }

    /* THE HIGHLIGHTER FIX: Ensures readable text in Dark Mode by forcing theme overrides */
    mark, .highlight, span[style*="background-color"] {
      background-color: ${themeMode === "dark" ? "rgba(59, 130, 246, 0.4)" : "rgba(253, 224, 71, 0.8)"} !important;
      color: ${themeMode === "dark" ? "#FFFFFF" : "#000000"} !important;
      border-radius: 4px;
      padding: 2px 4px;
    }
    
    /* Custom Monaco Block Styles */
    .custom-monaco-container {
      background-color: #1A1A1A !important;
      border-radius: 8px;
      margin: 16px 0;
      border: 1px solid ${themeMode === "dark" ? "#333" : "#E5E5E5"};
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #252525;
      padding: 8px 12px;
      border-bottom: 1px solid #333;
    }
    .lang-label {
      color: #A3A3A3;
      font-size: 11px;
      font-weight: bold;
      font-family: sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .custom-copy-btn {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #A3A3A3 !important;
      border: 1px solid rgba(255, 255, 255, 0.05) !important;
      border-radius: 6px !important;
      padding: 4px 10px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: bold !important;
      font-family: sans-serif !important;
      transition: all 0.2s;
    }
    .custom-copy-btn:active {
      background: rgba(255, 255, 255, 0.2) !important;
    }
    .custom-monaco-container pre {
      margin: 0 !important;
      padding: 16px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
    }
    .custom-monaco-container code {
      font-family: 'Courier New', Courier, monospace; 
      font-size: 14px;
      display: block;
      overflow-x: auto;
    }
    
    .hljs { background: transparent !important; padding: 0 !important; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
    a { color: #3B82F6; text-decoration: none; }
    p { margin-bottom: 16px; }
    h1, h2, h3, h4 { margin-top: 24px; margin-bottom: 12px; font-weight: 800; color: ${themeMode === "dark" ? "#FFFFFF" : "#000000"}; }
    ul, ol { margin-bottom: 16px; padding-left: 24px; }
    blockquote { border-left: 4px solid #3B82F6; padding-left: 16px; margin-left: 0; color: #6B7280; font-style: italic; }
  </style>
</head>
<body>
  ${content}
  <script>
    var svgCopy = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
    var svgCheck = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="#10B981" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';

    // 1. Handle custom Tiptap Monaco Blocks
    document.querySelectorAll('div[data-monaco-block]').forEach(function(block) {
      var rawCode = block.getAttribute('code') || '';
      var lang = block.getAttribute('language') || 'javascript';

      // Create main container
      var container = document.createElement('div');
      container.className = 'custom-monaco-container';

      // Create Header (Language Tag + Copy Button)
      var header = document.createElement('div');
      header.className = 'code-header';
      
      var langSpan = document.createElement('span');
      langSpan.className = 'lang-label';
      langSpan.innerText = lang;

      var btn = document.createElement('button');
      btn.className = 'custom-copy-btn';
      btn.innerHTML = svgCopy;
      
      btn.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        window.location.href = 'copycode://' + encodeURIComponent(rawCode);
        btn.innerHTML = svgCheck;
        setTimeout(() => { btn.innerHTML = svgCopy; }, 2000);
      };

      header.appendChild(langSpan);
      header.appendChild(btn);

      // Create Code Area
      var pre = document.createElement('pre');
      var codeEl = document.createElement('code');
      codeEl.className = 'language-' + lang;
      
      // Use textContent to safely render the raw code without executing it
      codeEl.textContent = rawCode; 
      
      pre.appendChild(codeEl);
      container.appendChild(header);
      container.appendChild(pre);

      // Apply Syntax Highlighting
      hljs.highlightElement(codeEl);

      // Replace the invisible div with our beautiful new UI
      block.parentNode.replaceChild(container, block);
    });

    // 2. Fallback for standard <pre> blocks (just in case)
    document.querySelectorAll('pre:not(.custom-monaco-container pre)').forEach(function(pre) {
      var code = document.createElement('code');
      code.innerHTML = pre.innerHTML;
      pre.innerHTML = '';
      pre.appendChild(code);
      hljs.highlightElement(code);
    });
  </script>
</body>
</html>
`;

export default function NotesScreen() {
  const themeMode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = themeMode === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [notes, setNotes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState("all");

  const [isCourseFilterOpen, setIsCourseFilterOpen] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);

  // NEW: State for our custom confirmation modal
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // --- THE ULTIMATE DUAL-COLLECTION MATCHER ---
  const getMatchedCourse = (note: any) => {
    if (!note) return null;

    const nId = String(
      note.courseId?._id || note.courseId?.id || note.courseId || "",
    ).trim();
    const nName = String(note.courseName || note.course || "")
      .trim()
      .toLowerCase();

    // 1. Check Standard Courses List
    let matchedC = courses.find((c) => {
      const cId = String(c._id || c.id).trim();
      const cName = String(c.name || "")
        .trim()
        .toLowerCase();

      if (cId && nId && cId === nId) return true;
      if (cName && nName && cName === nName) return true;
      if (cName && nId && cName === nId.toLowerCase()) return true;
      return false;
    });

    if (matchedC) return matchedC;

    // 2. Check Timetable List (In case Web App saved Timetable IDs instead)
    let matchedT = timetable.find((t) => {
      const tId = String(t._id || t.id).trim();
      const tName = String(t.courseName || t.name || "")
        .trim()
        .toLowerCase();

      if (tId && nId && tId === nId) return true;
      if (tName && nName && tName === nName) return true;
      if (tName && nId && tName === nId.toLowerCase()) return true;
      return false;
    });

    if (matchedT) {
      return {
        _id: matchedT._id || matchedT.id,
        name: matchedT.courseName || matchedT.name,
        type: "university", // Automatically treat timetable entries as uni courses
      };
    }

    return null; // Fallback to "General" if both fail
  };

  const fetchData = async () => {
    try {
      const [cNotes, cCourses, cTime] = await Promise.all([
        AsyncStorage.getItem("off_notes_data"),
        AsyncStorage.getItem("off_acad_courses"),
        AsyncStorage.getItem("off_acad_time"),
      ]);

      if (cNotes) setNotes(JSON.parse(cNotes));
      if (cCourses) setCourses(JSON.parse(cCourses));
      if (cTime) setTimetable(JSON.parse(cTime));
      if (cNotes) setIsLoading(false);

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) {
        setIsLoading(false);
        return;
      }

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
      const [notesRes, coursesRes, timeRes] = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/notes?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/courses?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/timetable?t=${timestamp}`, config),
      ]);

      if (notesRes.status === "rejected" || coursesRes.status === "rejected") {
        setIsOffline(true);
      } else {
        setIsOffline(false);
      }

      if (notesRes.status === "fulfilled") {
        const freshNotes = Array.isArray(notesRes.value.data)
          ? notesRes.value.data
          : [];
        const activeNotes = freshNotes.filter((n: any) => !n.isDeleted);
        setNotes(activeNotes);
        AsyncStorage.setItem("off_notes_data", JSON.stringify(activeNotes));
      }

      if (coursesRes.status === "fulfilled") {
        const rawData = coursesRes.value.data;
        const freshCourses = Array.isArray(rawData)
          ? rawData
          : rawData?.courses || rawData?.data || [];
        setCourses(freshCourses);
        AsyncStorage.setItem("off_acad_courses", JSON.stringify(freshCourses));
      }

      if (timeRes.status === "fulfilled") {
        const freshTime = Array.isArray(timeRes.value.data)
          ? timeRes.value.data
          : [];
        setTimetable(freshTime);
        AsyncStorage.setItem("off_acad_time", JSON.stringify(freshTime));
      }
    } catch (error) {
      setIsOffline(true);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCourseSelect = (id: string) => {
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        const matchedCourse = getMatchedCourse(note);

        const query = searchQuery.toLowerCase();
        const matchSearch =
          note.title.toLowerCase().includes(query) ||
          stripHtml(note.content).toLowerCase().includes(query) ||
          (matchedCourse?.name?.toLowerCase() || "").includes(query);

        if (!matchSearch) return false;

        if (selectedCourses.length > 0) {
          const matchesSelected = selectedCourses.some((selectedId) => {
            if (
              selectedId === "general-task" &&
              (!matchedCourse || matchedCourse.name === "General")
            )
              return true;
            return (
              matchedCourse &&
              (matchedCourse._id === selectedId ||
                matchedCourse.id === selectedId)
            );
          });
          if (!matchesSelected) return false;
        }

        if (selectedDateRange !== "all") {
          const noteDate = new Date(note.createdAt).getTime();
          const now = Date.now();
          const daysDiff = (now - noteDate) / (1000 * 3600 * 24);

          if (selectedDateRange === "7d" && daysDiff > 7) return false;
          if (selectedDateRange === "30d" && daysDiff > 30) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [
    notes,
    courses,
    timetable,
    searchQuery,
    selectedCourses,
    selectedDateRange,
  ]);

  // 1. Opens the themed modal
  const handleDelete = (noteId: string) => {
    setNoteToDelete(noteId);
  };

  // 2. Executes the deletion when confirmed
  const confirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      await axios.put(
        `${BACKEND_URL}/notes/${noteToDelete}/delete`,
        {},
        { headers: { "x-auth-token": token } },
      );

      // If we are deleting the note we are currently viewing, close the viewer
      if (viewingNote?._id === noteToDelete) {
        setViewingNote(null);
      }

      setNoteToDelete(null); // Close modal on success
      fetchData();
    } catch (error) {
      Alert.alert("Connection Error", "Could not reach server to delete.");
      setNoteToDelete(null); // Close modal on error
    }
  };

  const openAttachment = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open file."),
    );
  };

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineContainer}>
          <View style={styles.offlinePill}>
            <Ionicons name="cloud-offline" size={12} color="#EF4444" />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        </View>
      )}

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.subtext} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes, code, or courses..."
            placeholderTextColor={theme.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={theme.subtext} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterControlRow}>
          <TouchableOpacity
            style={[
              styles.filterDropdownBtn,
              selectedCourses.length > 0 && styles.filterDropdownBtnActive,
            ]}
            onPress={() => setIsCourseFilterOpen(true)}
          >
            <Ionicons
              name="library-outline"
              size={16}
              color={
                selectedCourses.length > 0 ? theme.invertedText : theme.text
              }
            />
            <Text
              style={[
                styles.filterDropdownText,
                selectedCourses.length > 0 && styles.filterDropdownTextActive,
              ]}
            >
              {selectedCourses.length === 0
                ? "All Courses"
                : `${selectedCourses.length} Selected`}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={
                selectedCourses.length > 0 ? theme.invertedText : theme.subtext
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterDropdownBtn,
              selectedDateRange !== "all" && styles.filterDropdownBtnActive,
            ]}
            onPress={() => setIsDateFilterOpen(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={
                selectedDateRange !== "all" ? theme.invertedText : theme.text
              }
            />
            <Text
              style={[
                styles.filterDropdownText,
                selectedDateRange !== "all" && styles.filterDropdownTextActive,
              ]}
            >
              {selectedDateRange === "all"
                ? "All Time"
                : selectedDateRange === "7d"
                  ? "Last 7 Days"
                  : "Last 30 Days"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={
                selectedDateRange !== "all" ? theme.invertedText : theme.subtext
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
              tintColor={theme.text}
            />
          }
        >
          {filteredNotes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={64}
                color={theme.border}
              />
              <Text style={styles.emptyText}>No notes found.</Text>
              <Text style={styles.emptySubText}>
                Try adjusting your search or filters.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredNotes.map((note) => {
                const matchedCourse = getMatchedCourse(note);
                const isUni =
                  matchedCourse?.type === "uni" ||
                  matchedCourse?.type === "university";
                const rawText = stripHtml(note.content);

                return (
                  <TouchableOpacity
                    key={note._id}
                    style={styles.noteCard}
                    activeOpacity={0.7}
                    onPress={() => setViewingNote(note)}
                    onLongPress={() => handleDelete(note._id)}
                  >
                    <Text style={styles.noteTitle} numberOfLines={2}>
                      {note.title}
                    </Text>
                    <Text style={styles.notePreview} numberOfLines={3}>
                      {rawText || "Empty note..."}
                    </Text>

                    <View style={styles.noteFooter}>
                      <View style={styles.coursePill}>
                        {isUni ? (
                          <UCPLogo width={12} height={12} color={theme.brand} />
                        ) : (
                          <Ionicons name="book" size={12} color={theme.brand} />
                        )}
                        <Text style={styles.coursePillText}>
                          {matchedCourse?.name || "General"}
                        </Text>
                      </View>
                      <Text style={styles.dateText}>
                        {new Date(note.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={isCourseFilterOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCourseFilterOpen(false)}
        >
          <View
            style={[
              styles.filterModalBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Course</Text>
              <TouchableOpacity onPress={() => setSelectedCourses([])}>
                <Text
                  style={{
                    color: theme.brand,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={styles.modalOpt}
                onPress={() => toggleCourseSelect("general-task")}
              >
                <View style={styles.modalOptLeft}>
                  <Ionicons name="book" size={16} color={theme.subtext} />
                  <Text style={styles.modalOptText}>General</Text>
                </View>
                <Ionicons
                  name={
                    selectedCourses.includes("general-task")
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={22}
                  color={
                    selectedCourses.includes("general-task")
                      ? theme.brand
                      : theme.subtext
                  }
                />
              </TouchableOpacity>

              {courses.map((course) => {
                const cId = course._id || course.id;
                const isSelected = selectedCourses.includes(cId);
                const isUni =
                  course.type === "uni" || course.type === "university";

                return (
                  <TouchableOpacity
                    key={cId}
                    style={styles.modalOpt}
                    onPress={() => toggleCourseSelect(cId)}
                  >
                    <View style={styles.modalOptLeft}>
                      {isUni ? (
                        <UCPLogo width={16} height={16} color={theme.text} />
                      ) : (
                        <Ionicons name="book" size={16} color={theme.subtext} />
                      )}
                      <Text style={styles.modalOptText}>{course.name}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={22}
                      color={isSelected ? theme.brand : theme.subtext}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isDateFilterOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDateFilterOpen(false)}
        >
          <View
            style={[
              styles.filterModalBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date</Text>
            </View>
            <TouchableOpacity
              style={styles.modalOpt}
              onPress={() => {
                setSelectedDateRange("all");
                setIsDateFilterOpen(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptText,
                  selectedDateRange === "all" && {
                    color: theme.brand,
                    fontWeight: "800",
                  },
                ]}
              >
                All Time
              </Text>
              {selectedDateRange === "all" && (
                <Ionicons name="checkmark" size={20} color={theme.brand} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOpt}
              onPress={() => {
                setSelectedDateRange("7d");
                setIsDateFilterOpen(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptText,
                  selectedDateRange === "7d" && {
                    color: theme.brand,
                    fontWeight: "800",
                  },
                ]}
              >
                Last 7 Days
              </Text>
              {selectedDateRange === "7d" && (
                <Ionicons name="checkmark" size={20} color={theme.brand} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOpt}
              onPress={() => {
                setSelectedDateRange("30d");
                setIsDateFilterOpen(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptText,
                  selectedDateRange === "30d" && {
                    color: theme.brand,
                    fontWeight: "800",
                  },
                ]}
              >
                Last 30 Days
              </Text>
              {selectedDateRange === "30d" && (
                <Ionicons name="checkmark" size={20} color={theme.brand} />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={!!viewingNote}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.viewerContainer}>
          <View
            style={[
              styles.viewerHeader,
              { paddingTop: Platform.OS === "ios" ? 20 : statusBarHeight },
            ]}
          >
            <TouchableOpacity
              onPress={() => setViewingNote(null)}
              style={styles.iconBtn}
            >
              <Ionicons name="chevron-down" size={28} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(viewingNote._id)}
              style={styles.iconBtn}
            >
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.viewerMeta}>
            <Text style={styles.viewerTitle}>{viewingNote?.title}</Text>

            <View style={styles.metaRow}>
              <View style={styles.coursePill}>
                {(() => {
                  const matchedViewerCourse = getMatchedCourse(viewingNote);
                  const isViewerUni =
                    matchedViewerCourse?.type === "uni" ||
                    matchedViewerCourse?.type === "university";
                  return (
                    <>
                      {isViewerUni ? (
                        <UCPLogo width={14} height={14} color={theme.brand} />
                      ) : (
                        <Ionicons name="book" size={14} color={theme.brand} />
                      )}
                      <Text style={styles.coursePillText}>
                        {matchedViewerCourse?.name || "General"}
                      </Text>
                    </>
                  );
                })()}
              </View>
              <Text style={styles.viewerDate}>
                {new Date(
                  viewingNote?.createdAt || Date.now(),
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              <Text style={styles.viewerDot}>•</Text>
              <Text style={styles.viewerReadTime}>
                {getReadTime(stripHtml(viewingNote?.content))}
              </Text>
            </View>

            {viewingNote?.referenceFiles?.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.attachmentScroll}
              >
                {viewingNote.referenceFiles.map((file: any, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.attachmentPill}
                    onPress={() => openAttachment(file.fileUrl)}
                  >
                    <Ionicons
                      name="document-attach"
                      size={14}
                      color={theme.brand}
                    />
                    <Text style={styles.attachmentText}>{file.fileName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <WebView
            source={{
              html: generateHtml(viewingNote?.content || "", themeMode),
            }}
            style={{ flex: 1, backgroundColor: theme.background }}
            showsVerticalScrollIndicator={false}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith("copycode://")) {
                const text = decodeURIComponent(
                  request.url.split("copycode://")[1],
                );
                Clipboard.setStringAsync(text);
                return false;
              }
              return true;
            }}
          />
        </View>
      </Modal>

      {/* THEMED CONFIRMATION MODAL */}
      <Modal visible={!!noteToDelete} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNoteToDelete(null)}
        >
          <View
            style={[
              styles.confirmModalBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.confirmIconContainer}>
              <Ionicons name="trash-outline" size={32} color="#EF4444" />
            </View>

            <Text style={[styles.confirmTitle, { color: theme.text }]}>
              Move to Bin?
            </Text>
            <Text style={[styles.confirmMessage, { color: theme.subtext }]}>
              Are you sure you want to move this note to the recycle bin?
            </Text>

            <View style={styles.confirmActionRow}>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => setNoteToDelete(null)}
              >
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#EF4444" }]}
                onPress={confirmDelete}
              >
                <Text style={[styles.confirmBtnText, { color: "#FFFFFF" }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    offlineContainer: {
      flexDirection: "row",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingBottom: 10,
    },
    offlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    offlineText: { color: "#EF4444", fontSize: 11, fontWeight: "800" },
    searchSection: { paddingHorizontal: 24, marginBottom: 16, marginTop: 10 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      fontSize: 16,
      color: theme.text,
      fontWeight: "500",
    },
    filterControlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    filterDropdownBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterDropdownBtnActive: {
      backgroundColor: theme.invertedBg,
      borderColor: theme.invertedBg,
    },
    filterDropdownText: { fontSize: 13, fontWeight: "700", color: theme.text },
    filterDropdownTextActive: { color: theme.invertedText },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      opacity: 0.8,
    },
    emptyText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800",
      marginTop: 20,
    },
    emptySubText: {
      color: theme.subtext,
      fontSize: 14,
      marginTop: 8,
      textAlign: "center",
    },
    grid: { gap: 16 },
    noteCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    noteTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    notePreview: {
      fontSize: 14,
      color: theme.subtext,
      lineHeight: 20,
      marginBottom: 16,
    },
    noteFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 16,
      gap: 10, // Ensures a safe distance between the pill and the date
    },
    coursePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.brandBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      flexShrink: 1, // Allows the pill container to adapt dynamically
    },
    coursePillText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.brand,
      flexShrink: 1, // Lets the text truncate naturally based on real screen width
    },
    dateText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.subtext,
      flexShrink: 0, // Protects the date from ever being squished or pushed off screen
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    filterModalBox: {
      width: "100%",
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: "900", color: theme.text },
    modalOpt: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalOptLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingRight: 12,
    },
    modalOptText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      flexWrap: "wrap",
    },
    viewerContainer: { flex: 1, backgroundColor: theme.background },
    viewerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    iconBtn: { padding: 4 },
    viewerMeta: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    viewerTitle: {
      fontSize: 28,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 12,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    viewerDate: { fontSize: 13, color: theme.subtext, fontWeight: "600" },
    viewerDot: { fontSize: 13, color: theme.subtext, fontWeight: "800" },
    viewerReadTime: { fontSize: 13, color: theme.subtext, fontWeight: "600" },
    attachmentScroll: { marginTop: 16 },
    attachmentPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      marginRight: 10,
    },
    attachmentText: { fontSize: 12, fontWeight: "700", color: theme.text },

    // --- CONFIRMATION MODAL STYLES ---
    confirmModalBox: {
      width: "85%",
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    confirmIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    confirmTitle: {
      fontSize: 20,
      fontWeight: "900",
      marginBottom: 8,
    },
    confirmMessage: {
      fontSize: 14,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
    },
    confirmActionRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmBtnText: {
      fontSize: 15,
      fontWeight: "800",
    },
  });
