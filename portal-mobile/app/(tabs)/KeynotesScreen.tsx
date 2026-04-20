import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

import UCPLogo from "../../components/UCPLogo";
import useLiveSync from "../hooks/useLiveSync";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
    danger: "#F43F5E",
    success: "#10B981",
    warning: "#F59E0B",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
    brand: "#60A5FA",
    brandBg: "rgba(59, 130, 246, 0.1)",
    danger: "#FB7185",
    success: "#34D399",
    warning: "#FBBF24",
  },
};

type Keynote = {
  _id: string;
  userId: string;
  courseName: string;
  title: string;
  type: "text" | "image" | "audio" | "mixed";
  content: string;
  mediaUrls: string[];
  isRead: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
};

const isAudioUrl = (url: string) => {
  if (!url) return false;
  return (
    url.toLowerCase().includes("audio") ||
    url.match(/\.(m4a|mp3|wav|ogg|aac|webm|3gp|mp4)$/i) !== null
  );
};

const isDocumentUrl = (url: string) => {
  if (!url) return false;
  return url.match(/\.(pdf|doc|docx|odt|txt|csv|xls|xlsx|ppt|pptx)$/i) !== null;
};

export default function KeynotesScreen({ navigation }: any) {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [keynotes, setKeynotes] = useState<Keynote[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<
    "all" | "today" | "week" | "month"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isCourseFilterOpen, setIsCourseFilterOpen] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const [viewingKeynote, setViewingKeynote] = useState<Keynote | null>(null);

  // --- EDIT MODAL STATE ---
  const [editingKeynote, setEditingKeynote] = useState<Keynote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- MEDIA EDITING STATE ---
  type MediaFile = {
    uri: string;
    type: "image" | "audio" | "document";
    isExternal?: boolean;
    name?: string;
    mimeType?: string;
  };
  const [editMediaFiles, setEditMediaFiles] = useState<MediaFile[]>([]);
  const [isEditRecording, setIsEditRecording] = useState(false);
  const [editRecording, setEditRecording] = useState<
    Audio.Recording | undefined
  >();
  const [showEditAttachMenu, setShowEditAttachMenu] = useState(false);

  const [previewMedia, setPreviewMedia] = useState<{
    urls: string[];
    index: number;
  } | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success" as "success" | "error" | "info",
  });

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

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!token || !BACKEND_URL) return;

      const [keynotesRes, coursesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/keynotes`, {
          headers: { "x-auth-token": token },
        }),
        axios.get(`${BACKEND_URL}/courses`, {
          headers: { "x-auth-token": token },
        }),
      ]);

      setKeynotes(keynotesRes.data || []);
      setCourses(coursesRes.data || []);
    } catch (error) {
      showToast("Failed to load keynotes", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const unsubscribe = navigation?.addListener("focus", fetchData);
    return () => {
      unsubscribe?.();
      if (sound) sound.unloadAsync();
    };
  }, [navigation]);

  useLiveSync(fetchData);
  const filteredKeynotes = useMemo(() => {
    let filtered = [...keynotes];
    if (selectedCourse) {
      filtered = filtered.filter((k) => k.courseName === selectedCourse);
    }
    if (selectedDateRange !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter((k) => {
        const kDate = new Date(k.createdAt);
        switch (selectedDateRange) {
          case "today":
            return kDate >= today;
          case "week":
            return kDate >= weekAgo;
          case "month":
            return kDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (k) =>
          k.title.toLowerCase().includes(query) ||
          k.content?.toLowerCase().includes(query) ||
          k.courseName.toLowerCase().includes(query),
      );
    }
    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [keynotes, selectedCourse, selectedDateRange, searchQuery]);

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

  const toggleReadStatus = async (keynote: Keynote) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!token || !BACKEND_URL) return;

      const endpoint = keynote.isRead ? "unread" : "read";
      await axios.put(
        `${BACKEND_URL}/keynotes/${keynote._id}/${endpoint}`,
        {},
        { headers: { "x-auth-token": token } },
      );

      setKeynotes((prev) =>
        prev.map((k) =>
          k._id === keynote._id ? { ...k, isRead: !k.isRead } : k,
        ),
      );
      if (viewingKeynote && viewingKeynote._id === keynote._id) {
        setViewingKeynote((prev) =>
          prev ? { ...prev, isRead: !prev.isRead } : null,
        );
      }
      showToast(
        keynote.isRead ? "Marked as unread" : "Marked as read",
        "success",
      );
    } catch (error) {
      showToast("Failed to update status", "error");
    }
  };

  const deleteKeynote = async (keynote: Keynote) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!token || !BACKEND_URL) return;

      await axios.put(
        `${BACKEND_URL}/keynotes/${keynote._id}/delete`,
        {},
        { headers: { "x-auth-token": token } },
      );
      setKeynotes((prev) => prev.filter((k) => k._id !== keynote._id));
      if (viewingKeynote && viewingKeynote._id === keynote._id) {
        setViewingKeynote(null);
      }
      showToast("Moved to bin", "success");
    } catch (error) {
      showToast("Failed to delete", "error");
    }
  };

  const openEditModal = (keynote: Keynote) => {
    setEditingKeynote(keynote);
    setEditTitle(keynote.title);
    setEditContent(keynote.content || "");
    setEditCourse(keynote.courseName);

    const mappedMedia: MediaFile[] = (keynote.mediaUrls || []).map((url) => {
      const type = isAudioUrl(url)
        ? "audio"
        : isDocumentUrl(url)
          ? "document"
          : "image";
      const name = url.split("/").pop()?.split("?")[0] || "Attachment";
      return { uri: url, type, isExternal: true, name };
    });
    setEditMediaFiles(mappedMedia);
    setShowEditModal(true);
  };

  const removeEditMedia = (index: number) => {
    setEditMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSnap = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return showToast("Camera required.", "error");
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled) {
      setEditMediaFiles((prev) => [
        ...prev,
        {
          uri: result.assets[0].uri,
          type: "image",
          name: result.assets[0].uri.split("/").pop(),
        },
      ]);
    }
  };

  const handleEditGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted")
      return showToast("Gallery access required.", "error");
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const newFiles = result.assets.map((a) => ({
        uri: a.uri,
        type: "image" as const,
        name: a.uri.split("/").pop(),
      }));
      setEditMediaFiles((prev) => [...prev, ...newFiles]);
    }
    setShowEditAttachMenu(false);
  };

  const handleEditPickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const file = result.assets[0];
        setEditMediaFiles((prev) => [
          ...prev,
          {
            uri: file.uri,
            type: "document",
            name: file.name,
            mimeType: file.mimeType,
          },
        ]);
      }
    } catch (err) {
      showToast("Failed to pick document", "error");
    }
    setShowEditAttachMenu(false);
  };

  const handleEditRecord = async () => {
    if (isEditRecording) {
      setIsEditRecording(false);
      if (editRecording) {
        await editRecording.stopAndUnloadAsync();
        const uri = editRecording.getURI();
        if (uri)
          setEditMediaFiles((prev) => [
            ...prev,
            { uri, type: "audio", name: "Voice Note.m4a" },
          ]);
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: newRec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setEditRecording(newRec);
        setIsEditRecording(true);
      } catch (err) {
        showToast("Failed to record", "error");
      }
    }
  };

  const saveEdit = async () => {
    if (!editingKeynote) return;
    if (!editTitle.trim()) return showToast("Title is required", "error");

    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!token || !BACKEND_URL) {
        showToast("Auth error", "error");
        return;
      }

      let finalMediaUrls: string[] = [];
      const externalFiles = editMediaFiles.filter((m) => m.isExternal);
      finalMediaUrls.push(...externalFiles.map((m) => m.uri));

      const localFiles = editMediaFiles.filter((m) => !m.isExternal);

      if (localFiles.length > 0) {
        const formData = new FormData();
        localFiles.forEach((media, index) => {
          const filename = media.name || `media_${index}`;
          const match = /\.(\w+)$/.exec(filename);
          const ext = match
            ? match[1].toLowerCase()
            : media.type === "audio"
              ? "m4a"
              : "jpg";
          let mime =
            media.type === "document" && media.mimeType
              ? media.mimeType
              : media.type === "audio"
                ? `audio/mp4`
                : `image/jpeg`;

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
          if (uploadData.urls) finalMediaUrls.push(...uploadData.urls);
        } catch (uploadError) {
          setIsSaving(false);
          return showToast("Could not upload new local files.", "error");
        }
      }

      let overallType = "text";
      if (editMediaFiles.length > 0) {
        overallType = "mixed";
        const typesSet = new Set(editMediaFiles.map((m) => m.type));
        if (typesSet.size === 1) {
          if (typesSet.has("image")) overallType = "image";
          if (typesSet.has("audio")) overallType = "audio";
        }
      }

      const response = await axios.put(
        `${BACKEND_URL}/keynotes/${editingKeynote._id}`,
        {
          title: editTitle.trim(),
          content: editContent.trim(),
          courseName: editCourse,
          type: overallType,
          mediaUrls: finalMediaUrls,
        },
        { headers: { "x-auth-token": token } },
      );

      setKeynotes((prev) =>
        prev.map((k) => (k._id === editingKeynote._id ? response.data : k)),
      );
      if (viewingKeynote && viewingKeynote._id === editingKeynote._id) {
        setViewingKeynote(response.data);
      }

      showToast("Keynote updated successfully", "success");
      setShowEditModal(false);
      setEditingKeynote(null);
    } catch (error) {
      showToast("Failed to save changes", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const playAudio = async (url: string) => {
    try {
      if (playingAudio === url) {
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
        setPlayingAudio(null);
        setSound(null);
      } else {
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
        );
        setSound(newSound);
        setPlayingAudio(url);
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingAudio(null);
            setSound(null);
          }
        });
      }
    } catch (error) {
      showToast("Failed to play audio", "error");
    }
  };

  // --- UPGRADED: NATIVE IMAGE DOWNLOADER WITH UI FEEDBACK ---
  const saveImageToGallery = async (uri: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need gallery access to save photos.",
        );
        return;
      }

      // 1. Turn on the loading spinner on the button
      setIsDownloading(true);

      const fileExt = uri.split(".").pop()?.split("?")[0] || "jpg";
      const fileName = `myportal_${Date.now()}.${fileExt}`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // 2. Download the file locally
      const downloadedFile = await FileSystem.downloadAsync(uri, fileUri);

      if (downloadedFile.status !== 200) {
        Alert.alert(
          "Error",
          `Server blocked download (Error ${downloadedFile.status})`,
        );
        return;
      }

      // 3. Save to the device gallery
      await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);

      // 4. Show a native success popup
      Alert.alert("Success! 🎉", "Image saved to your device gallery.");
    } catch (error) {
      console.error("Save Error:", error);
      Alert.alert("Error", "Failed to save image.");
    } finally {
      // 5. Turn off the loading spinner
      setIsDownloading(false);
    }
  };

  const shareMedia = async (url: string) => {
    try {
      await Share.share({ url: url, message: url });
    } catch (error) {
      showToast("Failed to share", "error");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const mins = Math.floor(diff / (1000 * 60));
        return mins <= 1 ? "Just now" : `${mins}m ago`;
      }
      return `${hours}h ago`;
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const renderKeynoteItem = ({ item }: { item: Keynote }) => {
    const hasMedia = (item.mediaUrls?.length ?? 0) > 0;
    const audioUrls = item.mediaUrls?.filter((u) => isAudioUrl(u)) || [];
    const documentUrls = item.mediaUrls?.filter((u) => isDocumentUrl(u)) || [];
    const imageUrls =
      item.mediaUrls?.filter((u) => !isAudioUrl(u) && !isDocumentUrl(u)) || [];

    return (
      <TouchableOpacity
        style={[styles.keynoteCard, !item.isRead && styles.unreadCard]}
        onPress={() => setViewingKeynote(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.courseBadge}>
            {renderCourseIcon(item.courseName, 14)}
            <Text style={styles.courseText}>{item.courseName}</Text>
          </View>
        </View>
        <Text style={styles.keynoteTitle}>{item.title}</Text>
        {item.content ? (
          <Text style={styles.keynoteContent} numberOfLines={3}>
            {item.content}
          </Text>
        ) : null}

        {hasMedia && (
          <View style={styles.mediaIndicatorsRow}>
            {imageUrls.length > 0 && (
              <View
                style={[
                  styles.mediaPill,
                  { backgroundColor: "rgba(244, 63, 94, 0.1)" },
                ]}
              >
                <Ionicons name="image-outline" size={14} color={theme.danger} />
                <Text style={[styles.mediaPillText, { color: theme.danger }]}>
                  {imageUrls.length}
                </Text>
              </View>
            )}
            {audioUrls.length > 0 && (
              <View
                style={[
                  styles.mediaPill,
                  { backgroundColor: "rgba(16, 185, 129, 0.1)" },
                ]}
              >
                <Ionicons name="mic-outline" size={14} color={theme.success} />
                <Text style={[styles.mediaPillText, { color: theme.success }]}>
                  {audioUrls.length}
                </Text>
              </View>
            )}
            {documentUrls.length > 0 && (
              <View
                style={[styles.mediaPill, { backgroundColor: theme.brandBg }]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={theme.brand}
                />
                <Text style={[styles.mediaPillText, { color: theme.brand }]}>
                  {documentUrls.length}
                </Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.brand} />
      </View>
    );
  }

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

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.subtext} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search keynotes..."
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
              selectedCourse && styles.filterDropdownBtnActive,
            ]}
            onPress={() => setIsCourseFilterOpen(true)}
          >
            <Ionicons
              name="library-outline"
              size={16}
              color={selectedCourse ? theme.invertedText : theme.text}
            />
            <Text
              style={[
                styles.filterDropdownText,
                selectedCourse && styles.filterDropdownTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedCourse ? selectedCourse : "All Courses"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={selectedCourse ? theme.invertedText : theme.subtext}
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
                : selectedDateRange === "today"
                  ? "Today"
                  : selectedDateRange === "week"
                    ? "This Week"
                    : "This Month"}
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

      <FlatList
        data={filteredKeynotes}
        renderItem={renderKeynoteItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchData();
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="bulb-outline"
              size={64}
              color={theme.border}
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.emptyTitle}>No keynotes yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to create your first snap
            </Text>
          </View>
        }
      />

      <Modal
        visible={!!viewingKeynote}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              onPress={() => setViewingKeynote(null)}
              style={styles.iconBtn}
            >
              <Ionicons name="chevron-down" size={28} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => toggleReadStatus(viewingKeynote!)}
                style={styles.iconBtn}
              >
                <Ionicons
                  name={
                    viewingKeynote?.isRead
                      ? "mail-open-outline"
                      : "mail-outline"
                  }
                  size={22}
                  color={theme.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setViewingKeynote(null);
                  openEditModal(viewingKeynote!);
                }}
                style={styles.iconBtn}
              >
                <Ionicons name="create-outline" size={22} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteKeynote(viewingKeynote!)}
                style={styles.iconBtn}
              >
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.viewerContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.metaRow}>
              <View style={styles.courseBadge}>
                {renderCourseIcon(viewingKeynote?.courseName || "", 14)}
                <Text style={styles.courseText}>
                  {viewingKeynote?.courseName}
                </Text>
              </View>
              <Text style={styles.timestamp}>
                {viewingKeynote ? formatDate(viewingKeynote.createdAt) : ""}
              </Text>
            </View>

            <Text style={styles.viewerTitle}>{viewingKeynote?.title}</Text>
            {viewingKeynote?.content ? (
              <Text style={styles.viewerDescription}>
                {viewingKeynote.content}
              </Text>
            ) : null}

            {(viewingKeynote?.mediaUrls?.length ?? 0) > 0 && (
              <View style={styles.viewerMediaSection}>
                <Text style={styles.sectionTitle}>Attached Media</Text>
                <View style={styles.mediaGrid}>
                  {viewingKeynote?.mediaUrls?.map((url, idx) => {
                    const isAudio = isAudioUrl(url);
                    const isDoc = isDocumentUrl(url);

                    if (isAudio) {
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.viewerAudioCard}
                          onPress={() => playAudio(url)}
                        >
                          <Ionicons
                            name={
                              playingAudio === url
                                ? "stop-circle"
                                : "play-circle"
                            }
                            size={36}
                            color={theme.success}
                          />
                          <View>
                            <Text style={styles.viewerAudioText}>
                              {playingAudio === url
                                ? "Playing Voice Note..."
                                : "Play Voice Note"}
                            </Text>
                            <Text style={styles.viewerAudioSubtext}>
                              Audio File
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    } else if (isDoc) {
                      const fileName =
                        url.split("/").pop()?.split("?")[0] ||
                        `Document ${idx + 1}`;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.viewerDocCard}
                          onPress={() => Linking.openURL(url)}
                        >
                          <Ionicons
                            name="document-text"
                            size={36}
                            color={theme.brand}
                          />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text
                              style={styles.viewerDocText}
                              numberOfLines={1}
                            >
                              {fileName}
                            </Text>
                            <Text style={styles.viewerDocSubtext}>
                              Tap to view document
                            </Text>
                          </View>
                          <Ionicons
                            name="download-outline"
                            size={24}
                            color={theme.brand}
                          />
                        </TouchableOpacity>
                      );
                    } else {
                      const imageOnlyUrls =
                        viewingKeynote?.mediaUrls?.filter(
                          (u) => !isAudioUrl(u) && !isDocumentUrl(u),
                        ) || [];
                      const imageIndex = imageOnlyUrls.indexOf(url);
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() =>
                            setPreviewMedia({
                              urls: imageOnlyUrls,
                              index: imageIndex !== -1 ? imageIndex : 0,
                            })
                          }
                        >
                          <Image
                            source={{ uri: url }}
                            style={styles.viewerImageThumb}
                            contentFit="cover"
                          />
                        </TouchableOpacity>
                      );
                    }
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.editModalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Keynote</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholderTextColor={theme.subtext}
              />

              <Text style={styles.label}>Course</Text>
              <View style={styles.courseSelector}>
                {[...uniCourses, ...generalCourses].map((course) => (
                  <TouchableOpacity
                    key={course._id}
                    style={[
                      styles.courseChip,
                      editCourse === course.name && styles.courseChipActive,
                    ]}
                    onPress={() => setEditCourse(course.name)}
                  >
                    {renderCourseIcon(course.name, 14)}
                    <Text
                      style={[
                        styles.courseChipText,
                        editCourse === course.name &&
                          styles.courseChipTextActive,
                      ]}
                    >
                      {course.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Content</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                numberOfLines={6}
                placeholderTextColor={theme.subtext}
              />

              <Text style={styles.label}>Manage Attachments</Text>
              {editMediaFiles.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10, paddingBottom: 5 }}
                >
                  {editMediaFiles.map((media, idx) => (
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
                      ) : media.type === "document" ? (
                        <View style={styles.documentThumbnail}>
                          <Ionicons
                            name="document-text"
                            size={32}
                            color={theme.brand}
                          />
                          <Text style={styles.docThumbText} numberOfLines={2}>
                            {media.name || "Web Document"}
                          </Text>
                        </View>
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
                        onPress={() => removeEditMedia(idx)}
                        style={styles.mediaRemoveBtn}
                      >
                        <Ionicons name="trash" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.subtext,
                    marginTop: 4,
                    fontStyle: "italic",
                  }}
                >
                  No attachments.
                </Text>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleEditSnap}
                >
                  <Ionicons name="camera" size={24} color={theme.brand} />
                  <Text style={[styles.actionBtnText, { color: theme.brand }]}>
                    Camera
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setShowEditAttachMenu(true)}
                >
                  <Ionicons name="attach" size={24} color={theme.brand} />
                  <Text style={[styles.actionBtnText, { color: theme.brand }]}>
                    Attach
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    isEditRecording && {
                      backgroundColor: theme.danger + "20",
                      borderColor: theme.danger,
                    },
                  ]}
                  onPress={handleEditRecord}
                >
                  <Ionicons
                    name={isEditRecording ? "stop-circle" : "mic"}
                    size={24}
                    color={isEditRecording ? theme.danger : theme.brand}
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: isEditRecording ? theme.danger : theme.brand },
                    ]}
                  >
                    {isEditRecording ? "Recording..." : "Voice"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={saveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditAttachMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditAttachMenu(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.attachMenuContent,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.attachMenuIndicator} />
            <Text style={styles.attachMenuTitle}>Add Attachment</Text>
            <View style={styles.attachOptionsRow}>
              <TouchableOpacity
                style={styles.attachOptionBox}
                onPress={handleEditGallery}
              >
                <View
                  style={[
                    styles.attachIconBg,
                    { backgroundColor: "rgba(244, 63, 94, 0.1)" },
                  ]}
                >
                  <Ionicons name="images" size={32} color={theme.danger} />
                </View>
                <Text style={styles.attachOptionText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachOptionBox}
                onPress={handleEditPickDocument}
              >
                <View
                  style={[
                    styles.attachIconBg,
                    { backgroundColor: theme.brandBg },
                  ]}
                >
                  <Ionicons
                    name="document-text"
                    size={32}
                    color={theme.brand}
                  />
                </View>
                <Text style={styles.attachOptionText}>Document</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!previewMedia} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPreviewMedia(null)}
          >
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          {previewMedia && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: previewMedia.index * SCREEN_WIDTH, y: 0 }}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                );
                setPreviewMedia((prev) => (prev ? { ...prev, index } : null));
              }}
            >
              {previewMedia.urls.map((url, idx) => (
                <View key={idx} style={styles.previewPage}>
                  <Image
                    source={{ uri: url }}
                    style={styles.previewImage}
                    contentFit="contain"
                  />

                  <View
                    style={{ flexDirection: "row", gap: 16, marginTop: 24 }}
                  >
                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={() => shareMedia(url)}
                    >
                      <Ionicons name="share-outline" size={24} color="#FFF" />
                      <Text style={styles.downloadBtnText}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.downloadBtn,
                        { backgroundColor: theme.brand },
                      ]}
                      onPress={() => saveImageToGallery(url)}
                      disabled={isDownloading} // Prevent double-tapping
                    >
                      {isDownloading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name="download-outline"
                            size={24}
                            color="#FFF"
                          />
                          <Text style={styles.downloadBtnText}>Save</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          {(previewMedia?.urls?.length ?? 0) > 1 && (
            <View style={styles.previewDots}>
              {previewMedia?.urls?.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.previewDot,
                    idx === previewMedia?.index && styles.previewDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={isCourseFilterOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCourseFilterOpen(false)}
        ></TouchableOpacity>
      </Modal>
      <Modal visible={isDateFilterOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDateFilterOpen(false)}
        ></TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { justifyContent: "center", alignItems: "center" },
    searchSection: { paddingHorizontal: 24, paddingTop: 16, marginBottom: 16 },
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
    filterDropdownText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
      flex: 1,
      textAlign: "center",
    },
    filterDropdownTextActive: { color: theme.invertedText },
    listContent: { paddingHorizontal: 24, paddingBottom: 100 },
    keynoteCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    unreadCard: { borderLeftWidth: 4, borderLeftColor: theme.brand },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
      gap: 12,
    },
    courseBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.brandBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 6,
      flexShrink: 1,
    },
    courseText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.brand,
      flexShrink: 1,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexShrink: 0,
    },
    iconBtn: { padding: 4 },
    keynoteTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    keynoteContent: {
      fontSize: 14,
      color: theme.subtext,
      lineHeight: 20,
      marginBottom: 12,
    },
    mediaIndicatorsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
      marginBottom: 16,
    },
    mediaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    mediaPillText: { fontSize: 13, fontWeight: "800" },
    timestamp: { fontSize: 12, color: theme.subtext, fontWeight: "600" },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: { fontSize: 14, color: theme.subtext, textAlign: "center" },
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
      paddingTop:
        Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 16 : 60,
      paddingBottom: 10,
    },
    viewerContent: { paddingHorizontal: 24, paddingBottom: 40 },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      marginTop: 8,
    },
    viewerTitle: {
      fontSize: 28,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 12,
    },
    viewerDescription: {
      fontSize: 16,
      color: theme.subtext,
      lineHeight: 24,
      marginBottom: 24,
    },
    viewerMediaSection: {
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    viewerImageThumb: {
      width: (SCREEN_WIDTH - 48 - 12) / 2,
      height: 140,
      borderRadius: 12,
    },
    viewerAudioCard: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.success + "15",
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.success + "30",
      gap: 16,
      marginBottom: 12,
    },
    viewerAudioText: { fontSize: 16, fontWeight: "800", color: theme.success },
    viewerAudioSubtext: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.success + "80",
      marginTop: 2,
    },
    viewerDocCard: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.brandBg,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.brand + "30",
      marginBottom: 12,
    },
    viewerDocText: { fontSize: 16, fontWeight: "800", color: theme.brand },
    viewerDocSubtext: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.brand + "80",
      marginTop: 2,
    },

    editModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: 40,
      maxHeight: "85%",
    },
    editModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    editModalTitle: { fontSize: 24, fontWeight: "900", color: theme.text },
    label: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.subtext,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
      color: theme.text,
      fontSize: 15,
    },
    textArea: { height: 120, textAlignVertical: "top" },
    courseSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    courseChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    courseChipActive: {
      backgroundColor: theme.brand + "15",
      borderColor: theme.brand,
    },
    courseChipText: { fontSize: 13, fontWeight: "600", color: theme.subtext },
    courseChipTextActive: { color: theme.brand },
    saveBtn: {
      backgroundColor: theme.brand,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 24,
    },
    saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

    actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
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
      backgroundColor: theme.card,
    },
    audioThumbnail: { flex: 1, alignItems: "center", justifyContent: "center" },
    documentThumbnail: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 8,
      backgroundColor: theme.brandBg,
    },
    docThumbText: {
      fontSize: 10,
      color: theme.text,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 4,
    },
    mediaRemoveBtn: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: 6,
      borderRadius: 20,
    },

    attachMenuContent: {
      width: "100%",
      padding: 24,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderWidth: 1,
    },
    attachMenuIndicator: {
      width: 40,
      height: 5,
      backgroundColor: theme.border,
      borderRadius: 3,
      alignSelf: "center",
      marginBottom: 20,
    },
    attachMenuTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 24,
      textAlign: "center",
    },
    attachOptionsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 10,
    },
    attachOptionBox: { alignItems: "center", gap: 12 },
    attachIconBg: {
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: "center",
      justifyContent: "center",
    },
    attachOptionText: { fontSize: 14, fontWeight: "700", color: theme.text },

    previewOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.95)",
      justifyContent: "center",
      alignItems: "center",
    },
    previewClose: {
      position: "absolute",
      top:
        Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 20 : 60,
      right: 20,
      zIndex: 10,
      padding: 8,
    },
    previewPage: {
      width: SCREEN_WIDTH,
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    previewImage: { width: "100%", height: "75%", borderRadius: 12 },
    downloadBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      gap: 8,
    },
    downloadBtnText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
    previewDots: {
      position: "absolute",
      bottom: 50,
      flexDirection: "row",
      gap: 8,
    },
    previewDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.3)",
    },
    previewDotActive: { backgroundColor: "#FFF" },
    toastContainer: {
      position: "absolute",
      top:
        Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 16 : 60,
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
  });
