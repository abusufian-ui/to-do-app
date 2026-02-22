import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
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

  // --- HAMBURGER MENU BUTTON FOR TOP HEADER ---
  const MenuHamburger = () => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setMenuVisible(true)}
      style={{ paddingHorizontal: 20 }}
    >
      <Ionicons name="menu" size={28} color={theme.text} />
    </TouchableOpacity>
  );

  const navigateFromMenu = (path: any) => {
    setMenuVisible(false);
    setTimeout(() => router.push(path), 200);
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerLeft: () => <MenuHamburger />,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: {
            color: theme.text,
            fontWeight: "800",
            fontSize: 18,
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
        }}
      >
        {/* --- 1. DASHBOARD --- */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <Ionicons name="grid" size={24} color={color} />
            ),
          }}
        />

        {/* --- 2. CLASSES --- */}
        <Tabs.Screen
          name="classes"
          options={{
            title: "Classes",
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar" size={24} color={color} />
            ),
          }}
        />

        {/* --- 3. THE FLOATING ADD BUTTON (DEAD CENTER) --- */}
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            headerTitle: "Add New", // Shows title at the top of the screen
            tabBarLabel: () => null, // Hides the text label underneath the icon
            tabBarIcon: () => (
              <View style={[styles.fab, { backgroundColor: theme.invertedBg }]}>
                <Ionicons name="add" size={32} color={theme.invertedText} />
              </View>
            ),
          }}
        />

        {/* --- 4. TASKS --- */}
        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            tabBarIcon: ({ color }) => (
              <Ionicons name="list" size={24} color={color} />
            ),
          }}
        />

        {/* --- 5. SETTINGS --- */}
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings" size={24} color={color} />
            ),
          }}
        />

        {/* --- HIDDEN ROUTES (Accessible via Side Menu) --- */}
        <Tabs.Screen
          name="habits"
          options={{ href: null, title: "Habit Protocol" }}
        />
        <Tabs.Screen
          name="cash"
          options={{ href: null, title: "Cash Manager" }}
        />
      </Tabs>

      {/* --- CUSTOM SLIDE-OUT SIDE MENU --- */}
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
                paddingTop: insets.top + 20,
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
                <Ionicons name="grid-outline" size={24} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Dashboard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/classes")}
              >
                <Ionicons name="school-outline" size={24} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Academics & Classes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/tasks")}
              >
                <Ionicons name="list-outline" size={24} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Tasks & Priorities
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
                  <Ionicons name="flame" size={20} color="#F43F5E" />
                </View>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Habit Protocol
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateFromMenu("/cash")}
              >
                <View style={styles.iconBgGreen}>
                  <Ionicons name="wallet" size={20} color="#10B981" />
                </View>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Cash Manager
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
                  size={24}
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
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -24, // Elevates the circle outside the bar
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
  },
  drawer: {
    width: width * 0.75,
    height: "100%",
    borderRightWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },

  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  drawerTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },

  menuItems: { padding: 24, paddingBottom: 60 },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  menuItemText: { fontSize: 16, fontWeight: "700" },

  iconBgPink: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBgGreen: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
});
