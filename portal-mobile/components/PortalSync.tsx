import { Ionicons } from "@expo/vector-icons";
import CookieManager from "@react-native-cookies/cookies";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, StyleSheet, Text, View } from "react-native";
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";

interface PortalSyncProps {
  jwtToken: string;
  onSyncComplete?: () => void;
}

const PortalSync: React.FC<PortalSyncProps> = ({
  jwtToken,
  onSyncComplete,
}) => {
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const webViewRef = useRef<WebView>(null);

  const [progressText, setProgressText] = useState("Authenticating...");
  const [progressPercent, setProgressPercent] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  // THE ULTIMATE EXTRACTION SCRIPT (WITH EXACT UCP URL ROUTING)
  const extractionScript = `
    (async function() {
      const sendProgress = (text, percent) => {
         window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PROGRESS', text, percent }));
      };

      try {
        console.log("Starting bulletproof background extraction on UCP Horizon...");
        sendProgress("Bypassing Microsoft SSO...", 15);
        
        let portalId = null;
        const courseLinks = [];
        const courseMap = new Map();
        let exactInProgressCr = 0;

        // --- 1. STRICT IDENTITY EXTRACTION ---
        sendProgress("Extracting Student Identity...", 25);
        const dashRes = await fetch('https://horizon.ucp.edu.pk/student/dashboard');
        if (dashRes.url.includes("login") || !dashRes.ok) {
            throw new Error("Student is logged out of Horizon. Please log in to UCP first.");
        }
        const dashHtml = await dashRes.text();
        const dashDoc = new DOMParser().parseFromString(dashHtml, 'text/html');
        const cleanPageText = dashDoc.body.textContent; 
        const idRegex = /[a-zA-Z]\\d[a-zA-Z]\\d{2}[a-zA-Z]+\\d{3,4}/i; 
        const match = cleanPageText.match(idRegex); 
        
        if (match) {
            portalId = match[0].toUpperCase();
        } else {
            throw new Error("Could not detect Portal ID.");
        }

        // --- 2. FETCH ENROLLED COURSES ---
        sendProgress("Finding Enrolled Courses...", 35);
        const enrolledRes = await fetch('https://horizon.ucp.edu.pk/student/enrolled/courses');
        const enrolledHtml = await enrolledRes.text();
        const enrolledDoc = new DOMParser().parseFromString(enrolledHtml, 'text/html');

        enrolledDoc.querySelectorAll('a[href*="/student/course/"]').forEach(el => {
            let href = el.getAttribute('href');
            if (!href) return;
            if (!href.startsWith('http')) href = 'https://horizon.ucp.edu.pk' + href;
            if (!courseLinks.includes(href)) courseLinks.push(href);

            const nameSpan = el.querySelector('span.md-list-heading');
            if (nameSpan) {
                let fullText = nameSpan.textContent.trim();
                let courseCode = "";
                let courseName = fullText;

                const codeRegex = /^([a-zA-Z]{2,5}[-\\s]?\\d{3,4})\\s*[-:]?\\s*(.*)$/;
                const codeMatch = fullText.match(codeRegex);
                if (codeMatch) {
                    courseCode = codeMatch[1].trim().toUpperCase();
                    courseName = codeMatch[2].trim(); 
                }
                
                let credits = 3.0; 
                el.querySelectorAll('span.sub-heading').forEach(sh => {
                    if (sh.textContent.includes('Credits:')) {
                        credits = parseFloat(sh.textContent.replace('Credits:', '').trim()) || 0;
                    }
                });

                exactInProgressCr += credits;
                courseMap.set(href, { name: courseName, code: courseCode, credits: credits });
            }
        });

        // --- 3. FETCH GRADES ---
        const scrapeGrades = async () => {
            let gradesData = [];
            for (const url of courseLinks) {
                try {
                    const response = await fetch(url);
                    const htmlText = await response.text();
                    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                    const realName = courseMap.has(url) ? courseMap.get(url).name : "Unknown Course";
                    const results = [];

                    doc.querySelectorAll('tr.table-parent-row').forEach(row => {
                        const nameAnchor = row.querySelector('a.toggle-childrens');
                        let summaryName = "Unknown";
                        let weightValue = "";

                        if (nameAnchor) {
                            let rawText = "";
                            nameAnchor.childNodes.forEach(node => { if (node.nodeType === 3) rawText += node.textContent; });
                            summaryName = rawText.replace(/\\s+/g, ' ').trim() || "Unknown";
                            const badge = nameAnchor.querySelector('.uk-badge');
                            if (badge) weightValue = badge.textContent.replace(/\\s+/g, '').trim(); 
                        }
                        
                        const tds = row.querySelectorAll('td');
                        let summaryPercentage = tds.length >= 2 ? tds[1].textContent.trim() : "0";

                        let childDetails = [];
                        let nextSibling = row.nextElementSibling;
                        while (nextSibling && !nextSibling.classList.contains('table-parent-row')) {
                            const childTds = nextSibling.querySelectorAll('td');
                            if (childTds.length >= 5) {
                                childDetails.push({ name: childTds[0].textContent.trim(), maxMarks: childTds[1].textContent.trim(), obtainedMarks: childTds[2].textContent.trim(), classAverage: childTds[3].textContent.trim(), percentage: childTds[4].textContent.trim() });
                            }
                            nextSibling = nextSibling.nextElementSibling;
                        }
                        results.push({ name: summaryName, weight: weightValue, percentage: summaryPercentage, details: childDetails });
                    });

                    const badges = doc.querySelectorAll('span.uk-badge');
                    let totalBadge = null;
                    for (let i = 0; i < badges.length; i++) {
                        if (badges[i].textContent.includes('/ 100')) { totalBadge = badges[i]; break; }
                    }
                    const totalPercentage = totalBadge ? totalBadge.textContent.split('/')[0].trim() : "0";
                    gradesData.push({ courseUrl: url, courseName: realName, assessments: results, totalPercentage: totalPercentage });
                } catch (e) {}
            }
            return gradesData;
        };

        // --- 4. EXPLICIT ATTENDANCE FETCH ---
        const scrapeAttendance = async () => {
            const attendanceData = [];
            for (const url of courseLinks) {
                try {
                    // Extract the raw course ID from the URL (e.g., 9zmqaW7JzB9YXJ53GMBy)
                    const courseId = url.split('/').pop();
                    const targetUrl = \`https://horizon.ucp.edu.pk/student/course/attendance/\${courseId}\`;
                    
                    const response = await fetch(targetUrl); 
                    const html = await response.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const realName = courseMap.has(url) ? courseMap.get(url).name : "Unknown Course";

                    const records = [];
                    doc.querySelectorAll('table tbody tr').forEach(row => {
                        const tds = row.querySelectorAll('td');
                        if (tds.length >= 3) {
                            const date = tds[1].textContent.trim();
                            let statusRaw = tds[2].textContent.trim().toLowerCase();
                            let status = 'Present';
                            if (statusRaw.includes('absent') || statusRaw.includes('leave')) status = 'Absent';

                            if (date && date.toLowerCase() !== 'date' && !date.includes('Weight')) {
                                records.push({ date, status });
                            }
                        }
                    });

                    const conducted = records.length;
                    const attended = records.filter(r => r.status === 'Present').length;
                    if (records.length > 0) {
                        attendanceData.push({ courseUrl: url, courseName: realName, summary: { conducted, attended }, records });
                    }
                } catch (e) {}
            }
            return attendanceData;
        };

        // --- 5. EXPLICIT ANNOUNCEMENTS FETCH ---
        const scrapeAnnouncements = async () => {
            const announcementsData = [];
            for (const url of courseLinks) {
                try {
                    // Extract the raw course ID and build the exact /info/ URL
                    const courseId = url.split('/').pop();
                    const targetUrl = \`https://horizon.ucp.edu.pk/student/course/info/\${courseId}\`;

                    const response = await fetch(targetUrl);
                    const html = await response.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const realName = courseMap.has(url) ? courseMap.get(url).name : "Unknown Course";

                    const news = [];
                    doc.querySelectorAll('table tbody tr').forEach(row => {
                        const tds = row.querySelectorAll('td');
                        if (tds.length >= 4) {
                            const subject = tds[1].textContent.trim();
                            const date = tds[2].textContent.trim();
                            const desc = tds[3].textContent.replace(/\\s+/g, ' ').trim();
                            if (subject && subject.toLowerCase() !== 'subject') {
                                news.push({ subject, date, description: desc });
                            }
                        }
                    });
                    if (news.length > 0) {
                        announcementsData.push({ courseUrl: url, courseName: realName, news });
                    }
                } catch(e) {}
            }
            return announcementsData;
        };

        // --- 6. EXPLICIT SUBMISSIONS FETCH ---
        const scrapeSubmissions = async () => {
            const submissionsData = [];
            for (const url of courseLinks) {
                try {
                    // Extract the raw course ID and build the exact /submission/ URL
                    const courseId = url.split('/').pop();
                    const targetUrl = \`https://horizon.ucp.edu.pk/student/course/submission/\${courseId}\`;

                    const response = await fetch(targetUrl);
                    const html = await response.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const realName = courseMap.has(url) ? courseMap.get(url).name : "Unknown Course";

                    const tasks = [];
                    doc.querySelectorAll('table.uk-table tbody tr.table-child-row').forEach(row => {
                        const tds = row.querySelectorAll('td');
                        if(tds.length >= 7) {
                            const name = tds[1].textContent.trim() || row.querySelector('.rec_submission_title')?.textContent.trim();
                            let desc = tds[2].textContent.trim() || row.querySelector('.rec_submission_description')?.textContent.trim();
                            desc = desc.replace(/\\s+/g, ' ').trim();
                            const startDate = tds[3].textContent.trim();
                            const dueDate = tds[4].textContent.trim();

                            let attachmentLink = tds[5].querySelector('a')?.getAttribute('href') || null;
                            if (attachmentLink && attachmentLink.startsWith('/')) attachmentLink = 'https://horizon.ucp.edu.pk' + attachmentLink;

                            const actionText = tds[6].textContent.toLowerCase();
                            let currentStatus = "Pending";
                            if (actionText.includes('submitted') || row.textContent.toLowerCase().includes('submitted successfully')) {
                                currentStatus = "Submitted";
                            }

                            if (name) {
                                tasks.push({ title: name, description: desc, startDate, dueDate, status: currentStatus, attachmentUrl: attachmentLink, submissionUrl: targetUrl });
                            }
                        }
                    });
                    if (tasks.length > 0) {
                        submissionsData.push({ courseUrl: url, courseName: realName, tasks });
                    }
                } catch(e) {}
            }
            return submissionsData;
        };

        // --- 7. FETCH HISTORY & STATS ---
        const scrapeHistory = async () => {
            const historyData = [];
            let statsData = { cgpa: "0.00", credits: "0", inprogressCr: exactInProgressCr.toString() };
            try {
                const historyResponse = await fetch('https://horizon.ucp.edu.pk/student/results');
                const historyHtml = await historyResponse.text();
                const hDoc = new DOMParser().parseFromString(historyHtml, 'text/html');
                let currentSemester = null;

                hDoc.querySelectorAll('table tbody tr').forEach(row => {
                    if (row.classList.contains('table-parent-row')) {
                        const tds = row.querySelectorAll('td');
                        if (tds.length >= 8) {
                            currentSemester = { term: tds[0].textContent.trim(), earnedCH: tds[4].textContent.trim(), sgpa: tds[6].textContent.trim(), cgpa: tds[7].textContent.trim(), courses: [] };
                            historyData.push(currentSemester);
                        }
                    } else if (row.classList.contains('table-child-row') && currentSemester) {
                        const tds = row.querySelectorAll('td');
                        if (tds.length >= 4) {
                            currentSemester.courses.push({ name: tds[0].textContent.trim(), creditHours: tds[1].textContent.trim(), gradePoints: tds[2].textContent.trim(), finalGrade: tds[3].textContent.trim() });
                        }
                    }
                });
                if (historyData.length > 0) {
                    const latestSem = historyData[historyData.length - 1];
                    const totalCredits = historyData.reduce((acc, sem) => acc + (parseFloat(sem.earnedCH) || 0), 0);
                    statsData.cgpa = latestSem.cgpa;
                    statsData.credits = totalCredits.toString();
                }
            } catch (historyError) {}
            return { historyData, statsData };
        };

        // --- 8. FETCH TIMETABLE ---
        const scrapeTimetable = async () => {
            let timetableData = [];
            const colorPalette = ['bg-teal-500/80', 'bg-emerald-600/80', 'bg-orange-400/90', 'bg-slate-500/90', 'bg-blue-500/80', 'bg-indigo-500/80', 'bg-pink-500/80'];
            try {
                const ttResponse = await fetch('https://horizon.ucp.edu.pk/student/class/schedule'); 
                const ttHtml = await ttResponse.text();
                const ttDoc = new DOMParser().parseFromString(ttHtml, 'text/html');
                let classIdCounter = 1;

                ttDoc.querySelectorAll('a[data-start][data-end]').forEach((el) => {
                    const startTime = el.getAttribute('data-start');
                    const endTime = el.getAttribute('data-end');
                    const em = el.querySelector('em');
                    const spans = el.querySelectorAll('span');

                    const instructor = em ? em.textContent.trim() : 'Unknown Instructor';
                    let scrapedName = spans.length > 0 ? spans[0].textContent.trim() : 'Unknown Course';
                    let room = spans.length > 2 ? spans[2].textContent.trim() : 'Unknown Room';
                    room = room.replace(/\\s+/g, ' ').replace(/\\( /g, '(').replace(/ \\)/g, ')').trim();

                    let cleanScrapedName = scrapedName.replace(/\\.{2,}/g, '').trim().toLowerCase();
                    let resolvedName = scrapedName.replace(/\\.{2,}/g, '').trim(); 
                    let matchedCode = ""; 
                    const isLabSession = room.toLowerCase().includes('(lab)');
                    
                    let bestMatch = resolvedName;
                    let foundPartialMatch = false;

                    for (const [url, data] of courseMap.entries()) {
                        const exactFullNameLower = data.name.toLowerCase();
                        if (exactFullNameLower.startsWith(cleanScrapedName) || cleanScrapedName.startsWith(exactFullNameLower)) {
                            const isLabCourse = exactFullNameLower.includes('lab') || exactFullNameLower.includes('laboratory');
                            if (isLabSession === isLabCourse) {
                                bestMatch = data.name; matchedCode = data.code; break; 
                            } else if (!foundPartialMatch) {
                                bestMatch = data.name; matchedCode = data.code; foundPartialMatch = true;
                            }
                        }
                    }

                    let day = 'Unknown';
                    const parentGroup = el.closest('.cd-schedule__group');
                    if (parentGroup) {
                        const dayHeader = parentGroup.querySelector('.top-info span, .cd-schedule__top-info span');
                        day = dayHeader ? dayHeader.textContent.trim() : (parentGroup.getAttribute('data-date') || parentGroup.id || 'Unknown');
                    }

                    timetableData.push({ id: classIdCounter++, day, startTime, endTime, courseName: bestMatch, courseCode: matchedCode, instructor, room, color: colorPalette[bestMatch.length % colorPalette.length] });
                });
            } catch (ttError) {}
            return timetableData;
        };

        // ==========================================
        // EXECUTE ALL TASKS
        // ==========================================
        sendProgress("Scraping Academic Data...", 45);
        const [gradesResult, historyResult, timetableResult] = await Promise.allSettled([
            scrapeGrades(), scrapeHistory(), scrapeTimetable()
        ]);

        sendProgress("Scraping Live Updates (Attendance & Deadlines)...", 75);
        const [attendanceResult, submissionsResult, announcementsResult] = await Promise.allSettled([
            scrapeAttendance(), scrapeSubmissions(), scrapeAnnouncements()
        ]);

        const courseMapObj = Object.fromEntries(courseMap);

        const scrapedPayload = { 
            portalId, 
            gradesData: gradesResult.status === 'fulfilled' ? gradesResult.value : [], 
            historyData: historyResult.status === 'fulfilled' ? historyResult.value.historyData : [], 
            statsData: historyResult.status === 'fulfilled' ? historyResult.value.statsData : { cgpa: "0.00", credits: "0", inprogressCr: exactInProgressCr.toString() }, 
            timetableData: timetableResult.status === 'fulfilled' ? timetableResult.value : [],
            attendanceData: attendanceResult.status === 'fulfilled' ? attendanceResult.value : [],
            submissionsData: submissionsResult.status === 'fulfilled' ? submissionsResult.value : [],
            announcementsData: announcementsResult.status === 'fulfilled' ? announcementsResult.value : [],
            courseLinks: courseLinks,
            courseMap: courseMapObj
        };

        sendProgress("Preparing Cloud Payload...", 90);
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'EXTRACTION_SUCCESS',
            payload: scrapedPayload
        }));

      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'EXTRACTION_ERROR',
            error: error.message || 'Unknown error occurred during extraction'
        }));
      }
    })();
    true;
  `;

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    if (url.includes("horizon.ucp.edu.pk/student/dashboard") && !isScraping) {
      setIsScraping(true);
      setProgressPercent(10);
      setProgressText("Initializing Master Scraper...");
      webViewRef.current?.injectJavaScript(extractionScript);
    }
  };

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "PROGRESS") {
        setProgressPercent(data.percent);
        setProgressText(data.text);
      } else if (data.type === "EXTRACTION_SUCCESS") {
        setProgressPercent(95);
        setProgressText("Syncing to Secure Server...");
        await executeHandoffToBackend(data.payload);
      } else if (data.type === "EXTRACTION_ERROR") {
        throw new Error(data.error);
      }
    } catch (error: any) {
      Alert.alert(
        "Sync Failed",
        error.message || "Could not extract portal data.",
      );
      setIsScraping(false);
      if (onSyncComplete) onSyncComplete();
    }
  };

  const executeHandoffToBackend = async (scrapedData: any) => {
    try {
      const horizonCookies = await CookieManager.get(
        "https://horizon.ucp.edu.pk",
      );
      const rootCookies = await CookieManager.get("https://ucp.edu.pk");
      const mergedCookies = { ...rootCookies, ...horizonCookies };

      const cookieString = Object.keys(mergedCookies)
        .map((key) => `${key}=${mergedCookies[key].value}`)
        .join("; ");
      scrapedData.ucpCookie = cookieString;

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

      const syncRes = await fetch(`${BACKEND_URL}/extension-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": jwtToken,
        },
        body: JSON.stringify(scrapedData),
      });

      if (syncRes.ok) {
        setProgressPercent(100);
        setProgressText("✓ Master Sync Successful!");

        setTimeout(() => {
          if (onSyncComplete) onSyncComplete();
        }, 1500);
      } else {
        const errorData = await syncRes.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Server Error: Status ${syncRes.status}`,
        );
      }
    } catch (error: any) {
      console.error("FULL SYNC ERROR:", error);
      Alert.alert(
        "Sync Rejected",
        error.message || "Failed to communicate with the server.",
      );
      setIsScraping(false);
      if (onSyncComplete) onSyncComplete();
    }
  };

  const widthInterpolation = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      {isScraping && (
        <View style={styles.overlay}>
          <View style={styles.loadingCard}>
            <Ionicons
              name={
                progressPercent === 100 ? "checkmark-circle" : "sync-circle"
              }
              size={54}
              color={progressPercent === 100 ? "#10b981" : "#3b82f6"}
              style={{ marginBottom: 10 }}
            />
            <Text style={styles.percentText}>{progressPercent}%</Text>

            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: widthInterpolation,
                    backgroundColor:
                      progressPercent === 100 ? "#10b981" : "#3b82f6",
                  },
                ]}
              />
            </View>

            <Text style={styles.statusText}>{progressText}</Text>
            <Text style={styles.subText}>
              Extracting native data. Do not close.
            </Text>
          </View>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{
          uri: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=4a6562df-f309-48d2-94c2-16d03a5c3644&response_type=code&redirect_uri=https%3A%2F%2Fhorizon.ucp.edu.pk%2Fauth_oauth%2Fmicrosoft%2Fsignin&prompt=select_account&scope=User.Read+Mail.Read+User.ReadWrite.All+Contacts.ReadWrite&sso_reload=true",
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        sharedCookiesEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        style={{ flex: 1, opacity: isScraping ? 0 : 1 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    width: "80%",
    padding: 30,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  percentText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 20,
  },
  progressBarBg: {
    width: "100%",
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
    marginBottom: 6,
  },
  subText: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
  },
});

export default PortalSync;
