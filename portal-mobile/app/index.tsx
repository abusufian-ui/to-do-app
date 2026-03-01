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

LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);

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

  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const radarAnim = useRef(new Animated.Value(0)).current; // New radar pulse animation

  useEffect(() => {
    // 1. Initial Entry Animation
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

    // 2. Continuous Radar Pulse Loop
    Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    ).start();

    // 3. Handle Background Initialization
    const initializeApp = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        const hasLaunched = await AsyncStorage.getItem("hasLaunched");

        if (!hasLaunched) {
          try {
            Notifications.requestPermissionsAsync();
          } catch (e) {
            console.log("Notification permission bypassed for simulator.");
          }
          await AsyncStorage.setItem("hasLaunched", "true");
        }

        setTimeout(() => {
          if (token) {
            router.replace("/(tabs)");
          } else {
            router.replace("/login");
          }
        }, 2500); // Slightly longer to let the radar animation play a full cycle
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
          justifyContent: "center",
        }}
      >
        {/* Radar Pulse Background */}
        <Animated.View
          style={[
            styles.radarPulse,
            {
              backgroundColor: theme.text,
              opacity: radarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0], // Fades out as it expands
              }),
              transform: [
                {
                  scale: radarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 3], // Triples in size
                  }),
                },
              ],
            },
          ]}
        />

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
  radarPulse: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    top: 0, // Aligns perfectly behind the iconBox
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
    zIndex: 2, // Keeps icon above the pulse
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.5,
    zIndex: 2,
  },
});
