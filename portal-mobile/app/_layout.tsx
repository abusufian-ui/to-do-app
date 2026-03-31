import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

// Import your custom animated splash component
import AnimatedSplashScreen from "../components/AnimatedSplashScreen";
// 🚀 IMPORT THE BACKGROUND SCRAPER ENGINE
import { registerBackgroundSync } from "../services/syncService";

// 1. Keep the native splash screen visible while we render our custom one
SplashScreen.preventAutoHideAsync();

// 2. Tell the app to show notifications even when in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }) as any,
});

// 3. Define the "Creative" Category with the Acknowledge Button
async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync("smart-alert", [
    {
      identifier: "ACKNOWLEDGE",
      buttonTitle: "Got it! 👍",
      options: { opensAppToForeground: false },
    },
  ]);

  // ADD THIS FOR NAMAZ
  await Notifications.setNotificationCategoryAsync("prayer-alert", [
    {
      identifier: "OFFER_PRAYER",
      buttonTitle: "Offer Prayer Now 🤲",
      options: { opensAppToForeground: false }, // Silent background action
    },
  ]);
}

export default function RootLayout() {
  // State for our custom splash animation
  const [appReady, setAppReady] = useState(false);
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);

  // --- APP BOOTSTRAP & SPLASH EFFECT ---
  useEffect(() => {
    async function prepare() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppReady(true);
        // Hide the native splash screen so our Animated one takes over
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  // --- NOTIFICATION ENGINE EFFECT ---
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#3B82F6",
      });
    }

    Notifications.setNotificationChannelAsync("prayer-channel-live", {
      name: "Prayer Alerts",
      importance: Notifications.AndroidImportance.MAX,
      sound: "azan.wav", // <--- This explicitly links your custom sound
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
    });

    const requestPermissions = async () => {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.log("Notification permissions denied!");
      }
    };

    requestPermissions();
    setupNotificationCategories();

    // 🚀 TURN ON THE BACKGROUND SCRAPER HERE
    registerBackgroundSync();

    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data;

          // 🚨 EXPIRED SESSION WATCHDOG 🚨
          if (data?.type === "session_expired") {
            await Notifications.dismissNotificationAsync(
              response.notification.request.identifier,
            );
            // ROUTE TO SETTINGS AND PASS THE AUTO-LAUNCH COMMAND
            router.push({
              pathname: "/(tabs)/settings",
              params: { autoLaunch: "true" },
            });
            return;
          }

          if (actionId === "ACKNOWLEDGE") {
            // 1. Dismiss the notification from the screen
            await Notifications.dismissNotificationAsync(
              response.notification.request.identifier,
            );

            // 2. Secretly tell the Render server we saw it!
            const taskId = response.notification.request.content.data?.taskId;
            if (taskId) {
              try {
                const token = await AsyncStorage.getItem("userToken");
                const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
                if (token && BACKEND_URL) {
                  await axios.put(
                    `${BACKEND_URL}/tasks/${taskId}/acknowledge`,
                    {},
                    {
                      headers: { "x-auth-token": token },
                    },
                  );
                  console.log("Task acknowledged on server!");
                }
              } catch (error) {
                console.log("Failed to acknowledge task", error);
              }
            }
          } else if (actionId === "OFFER_PRAYER") {
            // Dismiss notification
            await Notifications.dismissNotificationAsync(
              response.notification.request.identifier,
            );

            const prayerName =
              response.notification.request.content.data?.prayerName;
            if (prayerName) {
              try {
                const token = await AsyncStorage.getItem("userToken");
                const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
                if (token && BACKEND_URL) {
                  await axios.post(
                    `${BACKEND_URL}/namaz/offer`,
                    { prayerName },
                    { headers: { "x-auth-token": token } },
                  );
                  console.log(
                    `${prayerName} marked as offered via push notification!`,
                  );
                }
              } catch (error) {
                console.log("Failed to log prayer", error);
              }
            }
          }
        },
      );

    return () => {
      responseListener.remove();
    };
  }, []);

  // THE ULTIMATE FABRIC CRASH SHIELD:
  // The layout tree never changes structure, completely avoiding the "null child" crash.
  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* 1. Main App Navigation */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      {/* 2. Permanent Splash Screen Wrapper */}
      <View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000000",
          },
          // CRITICAL: Use opacity instead of display: none to maintain native layout nodes
          splashAnimationDone ? { opacity: 0 } : { opacity: 1 },
        ]}
        pointerEvents={splashAnimationDone ? "none" : "auto"}
      >
        <AnimatedSplashScreen
          onAnimationComplete={() => setSplashAnimationDone(true)}
        />
      </View>
    </View>
  );
}

axios.defaults.timeout = 8000;
