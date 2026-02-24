import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
    border: "#E5E5E5",
    card: "#FAFAFA",
    invertedBg: "#000000",
    invertedText: "#FFFFFF",
    invertedSubtext: "#A3A3A3",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
    invertedSubtext: "#737373",
  },
};

export default function CashScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const cTrans = await AsyncStorage.getItem("off_cash_trans");
      if (cTrans) {
        setTransactions(JSON.parse(cTrans));
        setIsLoading(false);
      }

      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) return setIsLoading(false);

      const res = await axios.get(`${BACKEND_URL}/transactions`, {
        headers: { "x-auth-token": token },
      });
      const freshData = Array.isArray(res.data) ? res.data : [];
      setTransactions(freshData);
      AsyncStorage.setItem("off_cash_trans", JSON.stringify(freshData));
    } catch (error) {
      console.log("Offline mode active.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "income")
        .reduce((acc, t) => acc + t.amount, 0),
    [transactions],
  );
  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce((acc, t) => acc + t.amount, 0),
    [transactions],
  );
  const netBalance = totalIncome - totalExpense;

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
              tintColor={theme.text}
            />
          }
        >
          <View style={styles.bentoGrid}>
            <View
              style={[
                styles.bentoBox,
                styles.bentoFull,
                { backgroundColor: theme.invertedBg },
              ]}
            >
              <Text
                style={[styles.bentoLabel, { color: theme.invertedSubtext }]}
              >
                NET BALANCE
              </Text>
              <Text
                style={[styles.bentoValueLg, { color: theme.invertedText }]}
              >
                Rs {netBalance.toLocaleString()}
              </Text>
            </View>
            <View style={styles.bentoRow}>
              <View style={[styles.bentoBox, styles.bentoHalf]}>
                <Ionicons
                  name="arrow-down-circle"
                  size={24}
                  color="#10B981"
                  style={{ marginBottom: 8 }}
                />
                <Text style={styles.bentoLabel}>INCOME</Text>
                <Text style={[styles.bentoValueSm, { color: "#10B981" }]}>
                  +{totalIncome.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.bentoBox, styles.bentoHalf]}>
                <Ionicons
                  name="arrow-up-circle"
                  size={24}
                  color="#F43F5E"
                  style={{ marginBottom: 8 }}
                />
                <Text style={styles.bentoLabel}>EXPENSE</Text>
                <Text style={[styles.bentoValueSm, { color: "#F43F5E" }]}>
                  -{totalExpense.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.sectionHeading}>RECENT TRANSACTIONS</Text>
          <View style={styles.transactionsContainer}>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>No recent transactions.</Text>
            ) : (
              transactions.map((t) => {
                const isIncome = t.type === "income";
                return (
                  <View key={t._id} style={styles.tRow}>
                    <View
                      style={[
                        styles.tIconBg,
                        {
                          backgroundColor: isIncome
                            ? "rgba(16, 185, 129, 0.1)"
                            : "rgba(244, 63, 94, 0.1)",
                        },
                      ]}
                    >
                      <Ionicons
                        name={isIncome ? "wallet" : "cart"}
                        size={20}
                        color={isIncome ? "#10B981" : "#F43F5E"}
                      />
                    </View>
                    <View style={styles.tInfo}>
                      <Text style={styles.tDesc} numberOfLines={1}>
                        {t.description}
                      </Text>
                      <Text style={styles.tCat}>
                        {t.category} •{" "}
                        {new Date(t.date || t.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.tAmount,
                        { color: isIncome ? "#10B981" : theme.text },
                      ]}
                    >
                      {isIncome ? "+" : "-"}Rs {t.amount.toLocaleString()}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      color: theme.subtext,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 20,
      fontStyle: "italic",
    },
    bentoGrid: { gap: 12, marginBottom: 30 },
    bentoBox: {
      padding: 20,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bentoFull: { alignItems: "center", paddingVertical: 30 },
    bentoRow: { flexDirection: "row", gap: 12 },
    bentoHalf: { flex: 1, backgroundColor: theme.card },
    bentoLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
    },
    bentoValueLg: {
      fontSize: 36,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 4,
    },
    bentoValueSm: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.5,
      marginTop: 4,
    },
    sectionHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1.5,
      marginBottom: 12,
      marginLeft: 5,
    },
    transactionsContainer: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tIconBg: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    tInfo: { flex: 1, marginRight: 10 },
    tDesc: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    tCat: { fontSize: 12, color: theme.subtext, fontWeight: "500" },
    tAmount: { fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
  });
