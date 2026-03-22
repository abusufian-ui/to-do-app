import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export const flushGlobalQueue = async () => {
  const token = await AsyncStorage.getItem("userToken");
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!token || !BACKEND_URL) return;

  const existingQueue = await AsyncStorage.getItem("global_sync_queue");
  if (!existingQueue) return;

  let queue = JSON.parse(existingQueue);
  if (queue.length === 0) return;

  let remainingQueue = [...queue];

  for (const action of queue) {
    try {
      if (action.type === "ADD") {
        await axios.post(`${BACKEND_URL}${action.endpoint}`, action.payload, {
          headers: { "x-auth-token": token },
        });
      } else if (action.type === "UPDATE") {
        await axios.put(`${BACKEND_URL}${action.endpoint}`, action.payload, {
          headers: { "x-auth-token": token },
        });
      } else if (action.type === "DELETE") {
        await axios.put(
          `${BACKEND_URL}${action.endpoint}`,
          {},
          {
            headers: { "x-auth-token": token },
          },
        );
      }
      // Success! Remove from queue.
      remainingQueue = remainingQueue.filter((a: any) => a.id !== action.id);
    } catch (error) {
      console.log(
        "Sync failed for an item, stopping queue to preserve timeline order.",
      );
      break;
    }
  }

  await AsyncStorage.setItem(
    "global_sync_queue",
    JSON.stringify(remainingQueue),
  );
};
