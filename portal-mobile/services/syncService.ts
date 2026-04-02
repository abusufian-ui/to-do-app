import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as cheerio from "cheerio";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

const BACKGROUND_SYNC_TASK = "UCP_BACKGROUND_SYNC";

// 🚀 1. THIS IS THE FUNCTION YOUR SETTINGS PAGE IS LOOKING FOR
export async function forceRunScraper() {
  try {
    const cookie = await AsyncStorage.getItem("ucpCookie");
    const token = await AsyncStorage.getItem("userToken");
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

    if (!cookie || !token || !BACKEND_URL) {
      console.log("⚠️ [SCRAPER] Missing Cookie, Token, or URL.");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log("🕵️‍♂️ [SCRAPER] Waking up to silently sync UCP Portal...");

    const axiosConfig = {
      headers: {
        Cookie: cookie,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      maxRedirects: 0,
      validateStatus: (status: number) => status >= 200 && status < 400,
    };

    console.log("🔍 [SCRAPER] Fetching courses...");
    const enrolledRes = await axios.get(
      "https://horizon.ucp.edu.pk/student/enrolled/courses",
      axiosConfig,
    );

    if (
      enrolledRes.status === 302 ||
      typeof enrolledRes.data !== "string" ||
      enrolledRes.data.includes('name="login"')
    ) {
      console.log(
        "💀 [SCRAPER] Session expired. Engine 5 will handle the push notification.",
      );
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const $courses = cheerio.load(enrolledRes.data);
    const courseLinks: string[] = [];
    const courseMap = new Map();

    $courses('a[href*="/student/course/"]').each((_, el) => {
      let href = $courses(el).attr("href");
      if (!href) return;
      if (!href.startsWith("http")) href = "https://horizon.ucp.edu.pk" + href;
      if (!courseLinks.includes(href)) courseLinks.push(href);

      const fullText = $courses(el).find("span.md-list-heading").text().trim();
      if (fullText) {
        let courseName = fullText;
        const codeMatch = fullText.match(
          /^([a-zA-Z]{2,5}[-\s]?\d{3,4})\s*[-:]?\s*(.*)$/,
        );
        if (codeMatch) courseName = codeMatch[2].trim();
        courseMap.set(href, courseName);
      }
    });

    console.log(
      `📚 [SCRAPER] Found ${courseLinks.length} courses! Commencing deep scrape...`,
    );

    if (courseLinks.length === 0)
      return BackgroundFetch.BackgroundFetchResult.NoData;

    const attendanceData: any[] = [];
    const announcementsData: any[] = [];
    const submissionsData: any[] = [];

    for (const url of courseLinks) {
      const courseId = url.split("/").pop();
      const courseName = courseMap.get(url) || "Unknown Course";

      try {
        // A. ATTENDANCE
        const attRes = await axios.get(
          `https://horizon.ucp.edu.pk/student/course/attendance/${courseId}`,
          axiosConfig,
        );
        const $att = cheerio.load(attRes.data);
        const records: any[] = [];

        $att("table tbody tr").each((_, row) => {
          const tds = $att(row).find("td");
          if (tds.length >= 3) {
            const date = $att(tds[1]).text().trim();
            const statusRaw = $att(tds[2]).text().trim().toLowerCase();
            const status =
              statusRaw.includes("absent") || statusRaw.includes("leave")
                ? "Absent"
                : "Present";
            if (
              date &&
              date.toLowerCase() !== "date" &&
              !date.includes("Weight")
            ) {
              records.push({ date, status });
            }
          }
        });

        if (records.length > 0) {
          attendanceData.push({
            courseUrl: url,
            courseName,
            summary: {
              conducted: records.length,
              attended: records.filter((r) => r.status === "Present").length,
            },
            records,
          });
        }

        // B. ANNOUNCEMENTS
        const annRes = await axios.get(
          `https://horizon.ucp.edu.pk/student/course/info/${courseId}`,
          axiosConfig,
        );
        const $ann = cheerio.load(annRes.data);
        const news: any[] = [];

        $ann("table tbody tr").each((_, row) => {
          const tds = $ann(row).find("td");
          if (tds.length >= 4) {
            const subject = $ann(tds[1]).text().trim();
            const date = $ann(tds[2]).text().trim();
            const desc = $ann(tds[3]).text().replace(/\s+/g, " ").trim();
            if (subject && subject.toLowerCase() !== "subject")
              news.push({ subject, date, description: desc });
          }
        });
        if (news.length > 0)
          announcementsData.push({ courseUrl: url, courseName, news });

        // C. SUBMISSIONS
        const subRes = await axios.get(
          `https://horizon.ucp.edu.pk/student/course/submission/${courseId}`,
          axiosConfig,
        );
        const $sub = cheerio.load(subRes.data);
        const tasks: any[] = [];

        $sub("table.uk-table tbody tr.table-child-row").each((_, row) => {
          const tds = $sub(row).find("td");
          if (tds.length >= 7) {
            const name =
              $sub(tds[1]).text().trim() ||
              $sub(row).find(".rec_submission_title").text().trim();
            const startDate = $sub(tds[3]).text().trim();
            const dueDate = $sub(tds[4]).text().trim();
            const currentStatus = $sub(tds[6])
              .text()
              .toLowerCase()
              .includes("submitted")
              ? "Submitted"
              : "Pending";
            if (name)
              tasks.push({
                title: name,
                description: "Auto-synced task",
                startDate,
                dueDate,
                status: currentStatus,
              });
          }
        });
        if (tasks.length > 0)
          submissionsData.push({ courseUrl: url, courseName, tasks });
      } catch (e) {
        console.log(`❌ [SCRAPER] Error on course ${courseName}`);
      }
    }

    console.log(
      `📦 [SCRAPER] Extraction done. Sending ${attendanceData.length} attendance, ${announcementsData.length} announcements, ${submissionsData.length} submissions to Render...`,
    );

    if (
      attendanceData.length > 0 ||
      announcementsData.length > 0 ||
      submissionsData.length > 0
    ) {
      await axios.post(
        `${BACKEND_URL}/extension-sync`,
        {
          portalId: "BACKGROUND_SYNC",
          attendanceData,
          announcementsData,
          submissionsData,
          ucpCookie: cookie,
        },
        {
          headers: { "x-auth-token": token },
        },
      );

      console.log("✅ [SCRAPER] Smart Diffing Sync Complete & Uploaded!");
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("❌ [SCRAPER] Fatal Sync Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

// 2. The Background Task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  return await forceRunScraper();
});

export async function registerBackgroundSync() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 900, // 🚀 15 Minutes: The "Golden Rule" for mobile OS
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log("🔋 Background Sync Engine Registered (15m Interval)!");
  } catch (err) {
    console.log("Failed to register background sync:", err);
  }
}
