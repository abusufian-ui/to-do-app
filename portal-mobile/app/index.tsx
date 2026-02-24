import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  LogBox,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

// --- THE FIX: MUTE EXPO GO SDK 53 WARNING ---
// This stops the red screen from taking over your app in development!
LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);

// --- Matches login.tsx Theme perfectly for seamless transition ---
const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
  },
};

export default function RootIndex() {
  const router = useRouter();
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;

  // --- Splash Animation Values ---
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Play the beautiful entry animation smoothly every time the app opens
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 10,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Handle Background Initialization
    const initializeApp = async () => {
      try {
        // Check Auth Token
        const token = await AsyncStorage.getItem("userToken");

        // Check if it's the first time opening the app to ask for permissions
        const hasLaunched = await AsyncStorage.getItem("hasLaunched");
        if (!hasLaunched) {
          try {
            // Non-blocking request so the animation doesn't freeze
            Notifications.requestPermissionsAsync();
          } catch (e) {
            console.log("Notification permission bypassed for simulator.");
          }
          await AsyncStorage.setItem("hasLaunched", "true");
        }

        // Wait exactly 1.8 seconds so the user can enjoy the splash animation
        setTimeout(() => {
          if (token) {
            router.replace("/(tabs)"); // Logged in -> Teleport to Dashboard
          } else {
            router.replace("/login"); // Logged out -> Teleport to Login
          }
        }, 1800);
      } catch (error) {
        console.error("Error during initialization:", error);
        router.replace("/login");
      }
    };

    initializeApp();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          alignItems: "center",
        }}
      >
        {/* Dynamic Icon Box */}
        <View style={[styles.iconBox, { backgroundColor: theme.text }]}>
          <Ionicons name="school" size={56} color={theme.background} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>MyPortal</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBox: {
    width: 100,
    height: 100,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
});
