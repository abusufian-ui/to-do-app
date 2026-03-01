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

// Generates perfectly formatted read-only HTML with FULL VS Code Syntax Highlighting
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
    pre { 
      background-color: #282c34 !important; 
      color: #abb2bf !important; 
      padding: 16px; 
      padding-top: 48px !important;
      border-radius: 8px; 
      overflow-x: auto; 
      font-family: 'Courier New', Courier, monospace; 
      font-size: 14px;
      margin: 16px 0;
      border: 1px solid ${themeMode === "dark" ? "#333" : "#E5E5E5"};
      position: relative;
    }
    /* Stop hljs from adding a duplicate background color */
    .hljs { background: transparent !important; padding: 0 !important; }
    
    .custom-copy-btn {
      position: absolute !important;
      top: 8px !important;
      right: 8px !important;
      background: rgba(255, 255, 255, 0.1) !important;
      color: #A3A3A3 !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 6px !important;
      padding: 6px 10px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: bold !important;
      font-family: sans-serif !important;
      z-index: 50 !important;
    }
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
    var svgCopy = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
    var svgCheck = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="#10B981" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';

    document.querySelectorAll('pre').forEach(function(pre) {
      // FIX: Wrap Quill's pre text in a <code> block so highlight.js applies VS Code colors correctly
      var code = document.createElement('code');
      code.innerHTML = pre.innerHTML;
      pre.innerHTML = '';
      pre.appendChild(code);
      
      // Execute the syntax highlight on the newly created code block
      hljs.highlightElement(code);

      // Inject the copy button
      var btn = document.createElement('button');
      btn.className = 'custom-copy-btn';
      btn.innerHTML = svgCopy;
      
      btn.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // Grab the raw text payload to copy
        var rawText = code.innerText.trim();
        window.location.href = 'copycode://' + encodeURIComponent(rawText);
        
        btn.innerHTML = svgCheck;
        setTimeout(() => { btn.innerHTML = svgCopy; }, 2000);
      };
      pre.appendChild(btn);
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // --- FILTER & SEARCH STATES ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]); // Array for Multi-select
  const [selectedDateRange, setSelectedDateRange] = useState("all");

  const [isCourseFilterOpen, setIsCourseFilterOpen] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const [viewingNote, setViewingNote] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [cNotes, cCourses] = await Promise.all([
        AsyncStorage.getItem("off_notes_data"),
        AsyncStorage.getItem("off_acad_courses"),
      ]);
      if (cNotes) setNotes(JSON.parse(cNotes));
      if (cCourses) setCourses(JSON.parse(cCourses));
      if (cNotes) setIsLoading(false);

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) {
        setIsLoading(false);
        return;
      }

      const config = { headers: { "x-auth-token": token }, timeout: 5000 };
      const timestamp = Date.now();

      const [notesRes, coursesRes] = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/notes?t=${timestamp}`, config),
        axios.get(`${BACKEND_URL}/courses?t=${timestamp}`, config),
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

  const toggleCourseSelect = (id: string) => {
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        // Search Query
        const query = searchQuery.toLowerCase();
        const matchSearch =
          note.title.toLowerCase().includes(query) ||
          stripHtml(note.content).toLowerCase().includes(query) ||
          courses
            .find((c) => (c._id || c.id) === note.courseId)
            ?.name?.toLowerCase()
            .includes(query);

        if (!matchSearch) return false;

        // Multi-Select Course Filter
        if (
          selectedCourses.length > 0 &&
          !selectedCourses.includes(note.courseId)
        ) {
          return false;
        }

        // Date Range Filter
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
  }, [notes, courses, searchQuery, selectedCourses, selectedDateRange]);

  const handleDelete = (noteId: string) => {
    Alert.alert(
      "Move to Bin",
      "Are you sure you want to move this note to the bin?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
              const token = await AsyncStorage.getItem("userToken");
              await axios.put(
                `${BACKEND_URL}/notes/${noteId}/delete`,
                {},
                { headers: { "x-auth-token": token } },
              );
              setViewingNote(null);
              fetchData();
            } catch (error) {
              Alert.alert(
                "Connection Error",
                "Could not reach server to delete. Connect to Wi-Fi and try again.",
              );
            }
          },
        },
      ],
    );
  };

  const openAttachment = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open file."),
    );
  };

  const selectedCourse = courses.find(
    (c) => (c._id || c.id) === viewingNote?.courseId,
  );
  const uniqueCourseIds = Array.from(new Set(notes.map((n) => n.courseId)));

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notes</Text>
        {isOffline && (
          <View style={styles.offlinePill}>
            <Ionicons name="cloud-offline" size={12} color="#EF4444" />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        )}
      </View>

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
                const matchedCourse = courses.find(
                  (c) => (c._id || c.id) === note.courseId,
                );
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
                        {matchedCourse?.type === "uni" ||
                        matchedCourse?.type === "university" ? (
                          <UCPLogo width={12} height={12} color={theme.brand} />
                        ) : (
                          <Ionicons name="book" size={12} color={theme.brand} />
                        )}
                        <Text style={styles.coursePillText} numberOfLines={1}>
                          {matchedCourse?.name || "General"}
                        </Text>
                      </View>
                      <Text style={styles.dateText}>
                        {new Date(note.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* --- MULTI-SELECT COURSE FILTER MODAL --- */}
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
                <Text style={styles.modalOptText}>General</Text>
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

              {uniqueCourseIds
                .filter((id) => id !== "general-task")
                .map((cId) => {
                  const matchedCourse = courses.find(
                    (c) => (c._id || c.id) === cId,
                  );
                  if (!matchedCourse) return null;
                  const isSelected = selectedCourses.includes(cId);

                  return (
                    <TouchableOpacity
                      key={cId}
                      style={styles.modalOpt}
                      onPress={() => toggleCourseSelect(cId)}
                    >
                      <Text style={styles.modalOptText}>
                        {matchedCourse.name}
                      </Text>
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

      {/* --- DATE RANGE FILTER MODAL --- */}
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

      {/* --- FULL SCREEN READ-ONLY VIEWER --- */}
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
                {selectedCourse?.type === "uni" ||
                selectedCourse?.type === "university" ? (
                  <UCPLogo width={14} height={14} color={theme.brand} />
                ) : (
                  <Ionicons name="book" size={14} color={theme.brand} />
                )}
                <Text style={styles.coursePillText} numberOfLines={1}>
                  {selectedCourse?.name || "General"}
                </Text>
              </View>
              <Text style={styles.viewerDate}>
                {new Date(
                  viewingNote?.createdAt || Date.now(),
                ).toLocaleDateString()}
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

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingBottom: 10,
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
      paddingVertical: 4,
      borderRadius: 12,
    },
    offlineText: { color: "#EF4444", fontSize: 11, fontWeight: "800" },

    searchSection: { paddingHorizontal: 24, marginBottom: 16 },
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

    // New Filter Dropdown Styles
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
    },
    coursePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.brandBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    coursePillText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.brand,
      maxWidth: 150,
    },
    dateText: { fontSize: 12, fontWeight: "600", color: theme.subtext },

    // Unified Modal Styles
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
    modalOptText: { fontSize: 16, fontWeight: "600", color: theme.text },

    // Viewer Styles
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
  });
