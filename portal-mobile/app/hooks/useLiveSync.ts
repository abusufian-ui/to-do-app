import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// Use your Expo env variable for the backend URL
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";

const useLiveSync = (onUpdateCallback: () => void) => {
  // 1. Keep track of the latest fetch function WITHOUT triggering re-renders
  const callbackRef = useRef(onUpdateCallback);

  useEffect(() => {
    callbackRef.current = onUpdateCallback;
  }, [onUpdateCallback]);

  useEffect(() => {
    // 2. Establish connection exactly ONCE per screen mount
    const socket: Socket = io(BACKEND_URL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("🟢 Mobile Connected to Live Data Sync WebSockets");
    });

    // 3. The Debounce Timer (Prevents the infinite loop crash)
    let debounceTimer: ReturnType<typeof setTimeout>;
    socket.on("live_db_update", () => {
      console.log("🔄 Live Update Detected! Queueing silent refresh...");

      // If the backend spams 10 updates in a row, this ensures we only fetch ONCE.
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (callbackRef.current) {
          callbackRef.current();
        }
      }, 1000); // Waits 1 second before fetching to let the database settle
    });

    socket.on("disconnect", () => {
      console.log("🔴 Mobile Disconnected from Live Data Sync");
    });

    // Cleanup connection when the component unmounts
    return () => {
      clearTimeout(debounceTimer);
      socket.disconnect();
    };
  }, []); // <--- THIS EMPTY ARRAY IS THE MAGIC FIX. IT PREVENTS THE LOOP.
};

export default useLiveSync;
