import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const Colors = {
  light: {
    background: "#F1F5F9",
    card: "#FFFFFF",
    text: "#0F172A",
    subtext: "#64748B",
    border: "#E2E8F0",
    activeTab: "#38BDF8",
    inactiveTab: "#F8FAFC",
    inputBg: "#F8FAFC",
  },
  dark: {
    background: "#020617",
    card: "#0F172A",
    text: "#F8FAFC",
    subtext: "#94A3B8",
    border: "#1E293B",
    activeTab: "#38BDF8",
    inactiveTab: "#1E293B",
    inputBg: "#020617",
  },
};

export default function AddScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [activeForm, setActiveForm] = useState<"task" | "cash" | "note">(
    "task",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    description: "",
    course: "",
    dueDate: "",
    noteContent: "",
  });

  const handleChange = (field: string, value: string) =>
    setFormData({ ...formData, [field]: value });

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      let endpoint = "";
      let payload = {};

      if (activeForm === "task") {
        endpoint = "/tasks";
        payload = { name: formData.title, date: formData.dueDate };
      } else if (activeForm === "cash") {
        endpoint = "/transactions";
        payload = {
          amount: Number(formData.amount),
          description: formData.description,
        };
      } else if (activeForm === "note") {
        endpoint = "/notes";
        payload = { course: formData.course, content: formData.noteContent };
      }

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!BACKEND_URL) {
        Alert.alert("Error", "Backend URL missing.");
        return;
      }

      const response = await axios.post(`${BACKEND_URL}${endpoint}`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 200 || response.status === 201) {
        Alert.alert(
          "Success!",
          `Your ${activeForm} was blasted to the portal.`,
        );
        setFormData({
          title: "",
          amount: "",
          description: "",
          course: "",
          dueDate: "",
          noteContent: "",
        });
      }
    } catch (error) {
      Alert.alert("Connection Error", "Could not reach the portal backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    switch (activeForm) {
      case "cash":
        return (
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Transaction Amount (Rs)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500"
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              value={formData.amount}
              onChangeText={(text) => handleChange("amount", text)}
            />
            <Text style={styles.inputLabel}>What was it for?</Text>
            <TextInput
              style={styles.input}
              placeholder="Lunch at campus cafe"
              placeholderTextColor={theme.subtext}
              value={formData.description}
              onChangeText={(text) => handleChange("description", text)}
            />
          </View>
        );
      case "note":
        return (
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Related Course (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Differential Equations"
              placeholderTextColor={theme.subtext}
              value={formData.course}
              onChangeText={(text) => handleChange("course", text)}
            />
            <Text style={styles.inputLabel}>Key Note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Type your rapid note here..."
              placeholderTextColor={theme.subtext}
              multiline={true}
              textAlignVertical="top"
              value={formData.noteContent}
              onChangeText={(text) => handleChange("noteContent", text)}
            />
          </View>
        );
      case "task":
      default:
        return (
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Task Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Complete DAA Assignment"
              placeholderTextColor={theme.subtext}
              value={formData.title}
              onChangeText={(text) => handleChange("title", text)}
            />
            <Text style={styles.inputLabel}>Due Date / Time</Text>
            <TextInput
              style={styles.input}
              placeholder="Tonight at 11:59 PM"
              placeholderTextColor={theme.subtext}
              value={formData.dueDate}
              onChangeText={(text) => handleChange("dueDate", text)}
            />
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeForm === "task" && styles.activeTab]}
            onPress={() => setActiveForm("task")}
          >
            <Ionicons
              name="checkbox-outline"
              size={20}
              color={activeForm === "task" ? "#FFFFFF" : theme.subtext}
            />
            <Text
              style={[
                styles.tabText,
                activeForm === "task" && styles.activeTabText,
              ]}
            >
              Task
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeForm === "cash" && styles.activeTab]}
            onPress={() => setActiveForm("cash")}
          >
            <Ionicons
              name="wallet-outline"
              size={20}
              color={activeForm === "cash" ? "#FFFFFF" : theme.subtext}
            />
            <Text
              style={[
                styles.tabText,
                activeForm === "cash" && styles.activeTabText,
              ]}
            >
              Cash
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeForm === "note" && styles.activeTab]}
            onPress={() => setActiveForm("note")}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={activeForm === "note" ? "#FFFFFF" : theme.subtext}
            />
            <Text
              style={[
                styles.tabText,
                activeForm === "note" && styles.activeTabText,
              ]}
            >
              Note
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>{renderForm()}</View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={22} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Blast to Portal</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: theme.inactiveTab,
      borderRadius: 16,
      padding: 6,
      marginBottom: 25,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      gap: 6,
    },
    activeTab: {
      backgroundColor: theme.activeTab,
      shadowColor: theme.activeTab,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    tabText: { fontSize: 14, fontWeight: "600", color: theme.subtext },
    activeTabText: { color: "#FFFFFF" },
    card: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 25,
    },
    formContainer: { gap: 15 },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      marginBottom: -5,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.text,
    },
    textArea: { height: 120 },
    submitBtn: {
      backgroundColor: theme.activeTab,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      borderRadius: 16,
      gap: 10,
      shadowColor: theme.activeTab,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    submitBtnText: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  });
