import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import cheerio from "cheerio-without-node-native";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

const BACKGROUND_SYNC_TASK = "UCP_BACKGROUND_SYNC";

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

    // 1. FETCH COURSES & IDENTITY
    const enrolledRes = await axios.get(
      "https://horizon.ucp.edu.pk/student/enrolled/courses",
      axiosConfig,
    );

    if (
      enrolledRes.status === 302 ||
      typeof enrolledRes.data !== "string" ||
      enrolledRes.data.includes('name="login"')
    ) {
      console.log("💀 [SCRAPER] Session expired. Firing local alert.");
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "UCP Session Expired ⚠️",
          body: "Your university portal session has expired. Tap here to log in.",
          data: { type: "session_expired" },
        },
        trigger: null,
      });
      await AsyncStorage.removeItem("ucpCookie");
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const $courses = cheerio.load(enrolledRes.data);
    const courseLinks: string[] = [];
    const courseMap = new Map();
    let exactInProgressCr = 0;

    $courses('a[href*="/student/course/"]').each((_: number, el: any) => {
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
        exactInProgressCr += 3.0; // Estimate
      }
    });

    console.log(
      `📚 [SCRAPER] Found ${courseLinks.length} courses! Commencing FULL deep scrape...`,
    );
    if (courseLinks.length === 0)
      return BackgroundFetch.BackgroundFetchResult.NoData;

    // DATA ARRAYS
    const attendanceData: any[] = [];
    const announcementsData: any[] = [];
    const submissionsData: any[] = [];
    const gradesData: any[] = [];

    // --- 2. THE HEAVY COURSE LOOP ---
    for (const url of courseLinks) {
      const courseId = url.split("/").pop();
      const courseName = courseMap.get(url) || "Unknown Course";

      try {
        // A. GRADES
        const gradeRes = await axios.get(url, axiosConfig);
        const $grade = cheerio.load(gradeRes.data);
        const assessments: any[] = [];

        $grade("tr.table-parent-row").each((_: number, row: any) => {
          const nameAnchor = $grade(row).find("a.toggle-childrens");
          let summaryName = "Unknown";
          let weightValue = "";
          if (nameAnchor.length > 0) {
            summaryName =
              nameAnchor
                .contents()
                .filter((_: number, el: any) => el.nodeType === 3)
                .text()
                .replace(/\s+/g, " ")
                .trim() || "Unknown";
            const badge = nameAnchor.find(".uk-badge");
            if (badge.length > 0)
              weightValue = badge.text().replace(/\s+/g, "").trim();
          }
          const tds = $grade(row).find("td");
          const summaryPercentage =
            tds.length >= 2 ? $grade(tds[1]).text().trim() : "0";

          let childDetails: any[] = [];
          let nextSibling = $grade(row).next();
          while (
            nextSibling.length > 0 &&
            !nextSibling.hasClass("table-parent-row")
          ) {
            const childTds = nextSibling.find("td");
            if (childTds.length >= 5) {
              childDetails.push({
                name: $grade(childTds[0]).text().trim(),
                maxMarks: $grade(childTds[1]).text().trim(),
                obtainedMarks: $grade(childTds[2]).text().trim(),
                percentage: $grade(childTds[4]).text().trim(),
              });
            }
            nextSibling = nextSibling.next();
          }
          assessments.push({
            name: summaryName,
            weight: weightValue,
            percentage: summaryPercentage,
            details: childDetails,
          });
        });

        let totalPercentage = "0";
        $grade("span.uk-badge").each((_: number, el: any) => {
          const text = $grade(el).text();
          if (text.includes("/ 100"))
            totalPercentage = text.split("/")[0].trim();
        });
        gradesData.push({
          courseUrl: url,
          courseName,
          assessments,
          totalPercentage,
        });

        // B. ATTENDANCE
        const attRes = await axios.get(
          `https://horizon.ucp.edu.pk/student/course/attendance/${courseId}`,
          axiosConfig,
        );
        const $att = cheerio.load(attRes.data);
        const records: any[] = [];
        $att("table tbody tr").each((_: number, row: any) => {
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
            )
              records.push({ date, status });
          }
        });
        if (records.length > 0)
          attendanceData.push({
            courseUrl: url,
            courseName,
            summary: {
              conducted: records.length,
              attended: records.filter((r) => r.status === "Present").length,
            },
            records,
          });

        // C. ANNOUNCEMENTS
        const annRes = await axios.get(
          `https://horizon.ucp.edu.pk/student/course/info/${courseId}`,
          axiosConfig,
        );
        const $ann = cheerio.load(annRes.data);
        const news: any[] = [];
        $ann("table tbody tr").each((_: number, row: any) => {
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

        // D. SUBMISSIONS
        const subRes = await axios.get(
          `https://horizon.ucp.edu.pk/student/course/submission/${courseId}`,
          axiosConfig,
        );
        const $sub = cheerio.load(subRes.data);
        const tasks: any[] = [];
        $sub("table.uk-table tbody tr.table-child-row").each(
          (_: number, row: any) => {
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
          },
        );
        if (tasks.length > 0)
          submissionsData.push({ courseUrl: url, courseName, tasks });
      } catch (e) {
        console.log(`❌ [SCRAPER] Error on course ${courseName}`);
      }
    }

    // --- 3. FETCH TIMETABLE & HISTORY ---
    console.log("🕒 [SCRAPER] Fetching Timetable & History...");
    const timetableData: any[] = [];
    const historyData: any[] = [];
    let statsData = {
      cgpa: "0.00",
      credits: "0",
      inprogressCr: exactInProgressCr.toString(),
    };

    try {
      const ttRes = await axios.get(
        "https://horizon.ucp.edu.pk/student/class/schedule",
        axiosConfig,
      );
      const $tt = cheerio.load(ttRes.data);
      let classIdCounter = 1;
      const colorPalette = [
        "#14b8a6",
        "#059669",
        "#fb923c",
        "#64748b",
        "#3b82f6",
      ];

      $tt("a[data-start][data-end]").each((_: number, el: any) => {
        const startTime = $tt(el).attr("data-start");
        const endTime = $tt(el).attr("data-end");
        const instructor = $tt(el).find("em").text().trim() || "Unknown";
        const spans = $tt(el).find("span");
        const scrapedName =
          spans.length > 0 ? $tt(spans[0]).text().trim() : "Unknown Course";
        let room =
          spans.length > 2 ? $tt(spans[2]).text().trim() : "Unknown Room";
        room = room.replace(/\s+/g, " ").trim();

        let day = "Unknown";
        const parentGroup = $tt(el).closest(".cd-schedule__group");
        if (parentGroup.length > 0) {
          const dayHeader = parentGroup.find(
            ".top-info span, .cd-schedule__top-info span",
          );
          if (dayHeader.length > 0) day = dayHeader.text().trim();
          else day = parentGroup.attr("data-date") || "Unknown";
        }

        timetableData.push({
          id: classIdCounter++,
          day,
          startTime,
          endTime,
          courseName: scrapedName.replace(/\.{2,}/g, "").trim(),
          courseCode: "",
          instructor,
          room,
          color: colorPalette[classIdCounter % 5],
        });
      });
    } catch (e) {}

    try {
      const histRes = await axios.get(
        "https://horizon.ucp.edu.pk/student/results",
        axiosConfig,
      );
      const $hist = cheerio.load(histRes.data);
      let currentSemester: any = null;

      $hist("table tbody tr").each((_: number, row: any) => {
        const $row = $hist(row);
        if ($row.hasClass("table-parent-row")) {
          const tds = $row.find("td");
          if (tds.length >= 8) {
            currentSemester = {
              term: $hist(tds[0]).text().trim(),
              earnedCH: $hist(tds[4]).text().trim(),
              sgpa: $hist(tds[6]).text().trim(),
              cgpa: $hist(tds[7]).text().trim(),
              courses: [],
            };
            historyData.push(currentSemester);
          }
        } else if ($row.hasClass("table-child-row") && currentSemester) {
          const tds = $row.find("td");
          if (tds.length >= 4)
            currentSemester.courses.push({
              name: $hist(tds[0]).text().trim(),
              creditHours: $hist(tds[1]).text().trim(),
              gradePoints: $hist(tds[2]).text().trim(),
              finalGrade: $hist(tds[3]).text().trim(),
            });
        }
      });
      if (historyData.length > 0) {
        statsData.cgpa = historyData[historyData.length - 1].cgpa;
        statsData.credits = historyData
          .reduce(
            (acc: number, sem: any) => acc + (parseFloat(sem.earnedCH) || 0),
            0,
          )
          .toString();
      }
    } catch (e) {}

    console.log(
      `📦 [SCRAPER] Extraction done. Sending ${attendanceData.length} attendance, ${announcementsData.length} announcements, ${submissionsData.length} submissions, ${gradesData.length} grades to Render...`,
    );

    // --- 4. SERVER HANDOFF ---
    if (
      attendanceData.length > 0 ||
      announcementsData.length > 0 ||
      submissionsData.length > 0 ||
      gradesData.length > 0
    ) {
      await axios.post(
        `${BACKEND_URL}/extension-sync`,
        {
          portalId: "BACKGROUND_SYNC",
          attendanceData,
          announcementsData,
          submissionsData,
          gradesData, // 🚨 Now safely included
          timetableData,
          historyData,
          statsData,
          ucpCookie: cookie,
        },
        { headers: { "x-auth-token": token } },
      );

      console.log("✅ [SCRAPER] 100% Full Unified Sync Complete!");
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("❌ [SCRAPER] Fatal Sync Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  return await forceRunScraper();
});

export async function registerBackgroundSync() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 900,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log("🔋 Full Background Sync Engine Registered!");
  } catch (err) {
    console.log("Failed to register background sync:", err);
  }
}
