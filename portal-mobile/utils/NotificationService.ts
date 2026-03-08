import axios from "axios";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Helper to safely schedule only if the time is in the future
const scheduleIfFuture = async (
  content: any,
  date: Date,
  identifier: string,
  channelId?: string,
) => {
  if (date.getTime() > Date.now()) {
    // 🔴 THE FIX: Explicitly assign "default" channel on Android if no custom channel is provided.
    // iOS works perfectly by just passing the Date object directly.
    const trigger: any =
      Platform.OS === "android"
        ? { date: date, channelId: channelId || "default" }
        : date;

    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger,
    });
  }
};

export const NotificationService = {
  // 1. TASKS WITH TIME
  scheduleTaskWithTime: async (
    taskId: string,
    title: string,
    taskDate: Date,
  ) => {
    const eventId = `task_${taskId}`;
    const fifteenMinsBefore = new Date(taskDate.getTime() - 15 * 60000);

    const baseContent = {
      title: "Upcoming Task",
      categoryIdentifier: "smart-alert",
      data: { eventId },
      sound: true,
    };

    // 15 mins before
    await scheduleIfFuture(
      { ...baseContent, body: `Starts in 15 mins: ${title}` },
      fifteenMinsBefore,
      `${eventId}_15m`,
    );

    // Exact time (Red alert style)
    await scheduleIfFuture(
      {
        ...baseContent,
        title: "🚨 Task Overdue!",
        body: `It's time for: ${title}`,
      },
      taskDate,
      `${eventId}_exact`,
    );
  },

  // 2. TASKS WITHOUT TIME (9 AM, 12 PM, 4 PM, 9 PM)
  scheduleTaskWithoutTime: async (
    taskId: string,
    title: string,
    taskDateStr: string,
  ) => {
    const eventId = `task_${taskId}`;
    const [year, month, day] = taskDateStr.split("-").map(Number);
    const targetHours = [9, 12, 16, 21]; // 9 AM, 12 PM, 4 PM, 9 PM

    const content = {
      title: "Task Reminder",
      body: `Don't forget: ${title}`,
      categoryIdentifier: "smart-alert",
      data: { eventId },
      sound: true,
    };

    for (let i = 0; i < targetHours.length; i++) {
      const scheduleTime = new Date(year, month - 1, day, targetHours[i], 0, 0);
      await scheduleIfFuture(
        content,
        scheduleTime,
        `${eventId}_hour_${targetHours[i]}`,
      );
    }
  },

  // 3. CLASSES
  scheduleClass: async (
    classId: string,
    className: string,
    classStartTime: Date,
  ) => {
    const eventId = `class_${classId}`;
    const fiveMinsBefore = new Date(classStartTime.getTime() - 5 * 60000);
    const fiveMinsAfter = new Date(classStartTime.getTime() + 5 * 60000);

    const baseContent = {
      categoryIdentifier: "smart-alert",
      data: { eventId },
      sound: true,
    };

    await scheduleIfFuture(
      {
        ...baseContent,
        title: "Class Starting Soon",
        body: `${className} starts in 5 mins.`,
      },
      fiveMinsBefore,
      `${eventId}_before`,
    );

    await scheduleIfFuture(
      {
        ...baseContent,
        title: "🚨 Class is Live!",
        body: `${className} is going on right now!`,
      },
      fiveMinsAfter,
      `${eventId}_after`,
    );
  },

  // 4. PRAYER NOTIFICATIONS (Lahore, Pakistan)
  schedulePrayersForToday: async () => {
    try {
      const response = await axios.get(
        "http://api.aladhan.com/v1/timingsByCity?city=Lahore&country=Pakistan&method=1",
      );
      const timings = response.data.data.timings;

      const prayersToSchedule = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
      const now = new Date();

      for (const prayer of prayersToSchedule) {
        const timeStr = timings[prayer];
        const [hours, minutes] = timeStr.split(":").map(Number);

        const prayerTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes,
          0,
        );

        const eventId = `prayer_${prayer}_${now.getDate()}`;

        await scheduleIfFuture(
          {
            title: `Time for ${prayer}`,
            body: "Allah hu akbar Allah hu akbar Allah hu akbar Allah hu akbar",
            categoryIdentifier: "smart-alert",
            data: { eventId },
            sound: "azan.wav",
          },
          prayerTime,
          `${eventId}_alert`,
          "prayer-sound", // Triggers the Android Azan channel!
        );
      }
    } catch (error) {
      console.log("Failed to fetch prayer times", error);
    }
  },
};
