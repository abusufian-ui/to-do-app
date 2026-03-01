import axios from "axios";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

// 1. Tell the app to show notifications even when in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }) as any,
});

// 2. Define the "Creative" Category with the Acknowledge Button
async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync("smart-alert", [
    {
      identifier: "ACKNOWLEDGE",
      buttonTitle: "Got it! 👍",
      options: {
        opensAppToForeground: false, // Completes action silently in the background!
      },
    },
  ]);
}

export default function RootLayout() {
  useEffect(() => {
    // --- ANDROID CHANNEL SETUP (Crucial for local alarms to work) ---
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    // Request permissions (Crucial for Android 13+)
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Notification permissions denied!");
      }
    };

    requestPermissions();
    setupNotificationCategories();

    // 3. Listen for the user tapping the "Got it! 👍" button
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const actionId = response.actionIdentifier;
        const data = response.notification.request.content.data as any;

        // If they tapped Acknowledge, cancel the exact-time backup notification
        if (actionId === "ACKNOWLEDGE" && data?.eventId) {
          console.log(
            `User acknowledged! Canceling backup alarm for ${data.eventId}`,
          );
          Notifications.cancelScheduledNotificationAsync(
            `${data.eventId}-exact`,
          );
        }
      });

    return () => {
      // TypeScript fix: modern way to remove the listener in Expo
      responseListener.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

axios.defaults.timeout = 8000;
