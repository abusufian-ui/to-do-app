import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
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

const { width } = Dimensions.get("window");

const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
    border: "#E5E5E5",
    card: "#FAFAFA",
    invertedBg: "#000000",
    invertedText: "#FFFFFF",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
  },
};

export default function TabLayout() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const safeTop =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const navigateFromMenu = (path: any) => {
    setMenuVisible(false);
    setTimeout(() => router.push(path), 200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: true,
          header: ({ options }) => {
            const title = String(
              options.headerTitle || options.title || route.name,
            );

            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.background,
                  paddingTop: (safeTop || 0) + 15,
                  paddingHorizontal: 24,
                  paddingBottom: 10,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setMenuVisible(true)}
                  style={{ marginRight: 16 }}
                >
                  <Ionicons name="menu" size={32} color={theme.text} />
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "800",
                    color: theme.text,
                    letterSpacing: -0.5,
                  }}
                >
                  {title}
                </Text>
              </View>
            );
          },
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            elevation: 0,
            height: Platform.OS === "ios" ? 85 : 70,
            paddingBottom: Platform.OS === "ios" ? 25 : 10,
          },
          tabBarActiveTintColor: theme.invertedBg,
          tabBarInactiveTintColor: theme.subtext,
          tabBarShowLabel: true,
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <Ionicons name="grid" size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="classes"
          options={{
            title: "Academics",
            tabBarIcon: ({ color }) => (
              <Ionicons name="school" size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="add"
          options={{
            title: "",
            headerTitle: "Quick Add",
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={[styles.fab, { backgroundColor: theme.invertedBg }]}>
                <Ionicons name="add" size={30} color={theme.invertedText} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            tabBarIcon: ({ color }) => (
              <Ionicons name="list" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings" size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="habits"
          options={{ href: null, title: "Habit Protocol" }}
        />
        <Tabs.Screen
          name="cash"
          options={{ href: null, title: "Cash Manager" }}
        />
        <Tabs.Screen name="notes" options={{ href: null, title: "Notes" }} />
      </Tabs>

      <Modal visible={menuVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.drawer,
              {
                backgroundColor: theme.card,
                borderRightColor: theme.border,
                paddingTop: (safeTop || 0) + 20,
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: theme.text }]}>
                MyPortal
              </Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Ionicons name="close" size={28} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.menuItems}
            >
              <Text style={[styles.menuSectionTitle, { color: theme.subtext }]}>
                CORE
              </Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/")}
              >
                <Ionicons name="grid-outline" size={22} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/classes")}
              >
                <Ionicons name="school-outline" size={22} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Academics
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/tasks")}
              >
                <Ionicons name="list-outline" size={22} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Tasks
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/notes")}
              >
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={theme.text}
                />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Notes
                </Text>
              </TouchableOpacity>

              <Text
                style={[
                  styles.menuSectionTitle,
                  { color: theme.subtext, marginTop: 24 },
                ]}
              >
                EXPANSIONS
              </Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/habits")}
              >
                <View style={styles.iconBgPink}>
                  <Ionicons name="flame" size={18} color="#F43F5E" />
                </View>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Habits
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/cash")}
              >
                <View style={styles.iconBgGreen}>
                  <Ionicons name="wallet" size={18} color="#10B981" />
                </View>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Cash
                </Text>
              </TouchableOpacity>

              <Text
                style={[
                  styles.menuSectionTitle,
                  { color: theme.subtext, marginTop: 24 },
                ]}
              >
                SYSTEM
              </Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/settings")}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={theme.text}
                />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  App Settings
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Platform.OS === "ios" ? -15 : -20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
  },
  drawer: { width: width * 0.75, height: "100%", borderRightWidth: 1 },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  drawerTitle: { fontSize: 22, fontWeight: "900" },
  menuItems: { padding: 20 },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  menuItemText: { fontSize: 16, fontWeight: "600" },
  iconBgPink: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBgGreen: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
});
