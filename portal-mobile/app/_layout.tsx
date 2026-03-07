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
      shouldSetBadge: true,
    }) as any, // <--- THE FIX IS HERE
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
        lightColor: "#3B82F6",
      });
    }

    // Request permissions (Crucial for Android 13+)
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

    // --- THE UPGRADED "ACKNOWLEDGE" ENGINE ---
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data as any;

          if (actionId === "ACKNOWLEDGE" && data?.eventId) {
            console.log(
              `User acknowledged! Sweeping and deleting all future alarms for ${data.eventId}`,
            );

            // 1. INSTANTLY DISMISS the notification from the tray (Triggers the cool slide-away OS animation)
            await Notifications.dismissNotificationAsync(
              response.notification.request.identifier,
            );

            // 2. Find ALL scheduled alarms on the phone
            const scheduled =
              await Notifications.getAllScheduledNotificationsAsync();

            // 3. Loop through and delete any that match this specific task/class sequence
            for (const notif of scheduled) {
              if (notif.identifier.startsWith(data.eventId)) {
                await Notifications.cancelScheduledNotificationAsync(
                  notif.identifier,
                );
              }
            }
          }
        },
      );

    return () => {
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
