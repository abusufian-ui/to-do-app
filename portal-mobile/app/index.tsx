import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    useColorScheme,
    View,
} from "react-native";

export default function RootIndex() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Check if the user has a saved token
        const token = await AsyncStorage.getItem("userToken");

        // 2. Route them based on the result
        if (token) {
          router.replace("/(tabs)"); // Logged in? Go to dashboard!
        } else {
          router.replace("/login"); // Not logged in? Go to login!
        }
      } catch (error) {
        console.error("Error checking auth token:", error);
        router.replace("/login"); // Failsafe: go to login
      }
    };

    // Run the check instantly when the app opens
    checkAuth();
  }, []);

  // Show a sleek loading spinner while it decides where to send you
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#000000" : "#FFFFFF" },
      ]}
    >
      <ActivityIndicator size="large" color="#38BDF8" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
