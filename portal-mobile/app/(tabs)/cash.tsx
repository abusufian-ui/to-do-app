import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
    brand: "#3B82F6",
    danger: "#F43F5E",
    success: "#10B981",
    warning: "#F59E0B",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    card: "#0A0A0A",
    invertedBg: "#FFFFFF",
    invertedText: "#000000",
    brand: "#60A5FA",
    danger: "#FB7185",
    success: "#34D399",
    warning: "#FBBF24",
  },
};

export default function CashScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight : insets.top;

  const [transactions, setTransactions] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeTab, setActiveTab] = useState<"transactions" | "debts">(
    "transactions",
  );
  const [currentDate, setCurrentDate] = useState(new Date());

  // Custom In-App Modal States
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: "transactions" | "debts";
  } | null>(null);

  const fetchData = async () => {
    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      const token = await AsyncStorage.getItem("userToken");
      if (!BACKEND_URL || !token) return setIsLoading(false);

      const [resTrans, resDebts] = await Promise.all([
        axios.get(`${BACKEND_URL}/transactions`, {
          headers: { "x-auth-token": token },
        }),
        axios.get(`${BACKEND_URL}/debts`, {
          headers: { "x-auth-token": token },
        }),
      ]);

      const freshTrans = Array.isArray(resTrans.data) ? resTrans.data : [];
      const freshDebts = Array.isArray(resDebts.data) ? resDebts.data : [];

      setTransactions(freshTrans);
      setDebts(freshDebts);

      AsyncStorage.setItem("off_cash_trans", JSON.stringify(freshTrans));
      AsyncStorage.setItem("off_cash_debts", JSON.stringify(freshDebts));
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

  // --- DELETE & UPDATE ACTIONS ---
  const promptDelete = (id: string, type: "transactions" | "debts") => {
    setItemToDelete({ id, type });
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const token = await AsyncStorage.getItem("userToken");

      await axios.put(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/${itemToDelete.type}/${itemToDelete.id}/delete`,
        {},
        { headers: { "x-auth-token": token } },
      );

      setDeleteModalVisible(false);
      setItemToDelete(null);
      fetchData();
    } catch (e) {
      console.log("Failed to move to bin.", e);
      setDeleteModalVisible(false);
    }
  };

  const toggleDebtStatus = async (id: string, currentStatus: string) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const isPending = currentStatus.toLowerCase() === "pending";
      const newStatus = isPending ? "paid" : "pending";

      // THE FIX: Appended "/status" to hit the correct backend route
      await axios.put(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/debts/${id}/status`,
        { status: newStatus },
        { headers: { "x-auth-token": token } },
      );
      fetchData();
    } catch (e) {
      console.log("Failed to update status.", e);
    }
  };

  // --- FILTERING LOGIC ---
  const isAllTime = isNaN(currentDate.getTime());

  // 1. Filter only by Date (Used for Calculations)
  const monthFilteredTransactions = useMemo(() => {
    if (isAllTime) return transactions;
    return transactions.filter((t) => {
      const d = new Date(t.date || t.createdAt);
      return (
        d.getMonth() === currentDate.getMonth() &&
        d.getFullYear() === currentDate.getFullYear()
      );
    });
  }, [transactions, currentDate, isAllTime]);

  // 2. Filter by Search (Used ONLY for rendering the list)
  const searchFilteredTransactions = useMemo(() => {
    if (!searchQuery) return monthFilteredTransactions;
    return monthFilteredTransactions.filter(
      (t) =>
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [monthFilteredTransactions, searchQuery]);

  const searchFilteredDebts = useMemo(() => {
    if (!searchQuery) return debts;
    return debts.filter(
      (d) =>
        d.person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [debts, searchQuery]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const totalIncome = monthFilteredTransactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = monthFilteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);
  const owedToMe = debts
    .filter((d) => d.type === "lent" && d.status.toLowerCase() === "pending")
    .reduce((acc, d) => acc + d.amount, 0);
  const iOwe = debts
    .filter(
      (d) => d.type === "borrowed" && d.status.toLowerCase() === "pending",
    )
    .reduce((acc, d) => acc + d.amount, 0);

  return (
    <View style={styles.container}>
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash" size={24} color={theme.danger} />
            </View>
            <Text style={styles.modalTitle}>Delete Record</Text>
            <Text style={styles.modalSub}>
              Are you sure you want to permanently delete this? This cannot be
              undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={styles.modalBtnDelete}
              >
                <Text style={styles.modalBtnTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "transactions" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("transactions")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "transactions" && { color: theme.invertedText },
            ]}
          >
            Cash
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "debts" && styles.tabBtnActive]}
          onPress={() => setActiveTab("debts")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "debts" && { color: theme.invertedText },
            ]}
          >
            Debts
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.subtext} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab}...`}
          placeholderTextColor={theme.subtext}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={16} color={theme.subtext} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
          {activeTab === "transactions" ? (
            <>
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => changeMonth(-1)}>
                  <Ionicons name="chevron-back" size={20} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCurrentDate(new Date(NaN))}>
                  <Text style={styles.monthText}>
                    {isAllTime
                      ? "All Time"
                      : currentDate.toLocaleString("default", {
                          month: "long",
                          year: "numeric",
                        })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => changeMonth(1)}>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.text}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.bentoBoxFull}>
                <Text style={styles.bentoLabel}>NET BALANCE</Text>
                <Text style={styles.bentoValueLg}>
                  Rs {(totalIncome - totalExpense).toLocaleString()}
                </Text>
              </View>

              <Text style={styles.sectionHeading}>TRANSACTIONS</Text>
              {searchFilteredTransactions.map((t) => (
                <View key={t._id} style={styles.tRow}>
                  <View style={styles.tInfo}>
                    <Text style={styles.tDesc}>{t.description}</Text>
                    <Text style={styles.tCat}>
                      {t.category} •{" "}
                      {new Date(t.date || t.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.actionGroup}>
                    <Text
                      style={[
                        styles.tAmount,
                        {
                          color:
                            t.type === "income" ? theme.success : theme.text,
                        },
                      ]}
                    >
                      {t.type === "income" ? "+" : "-"}Rs{" "}
                      {t.amount.toLocaleString()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => promptDelete(t._id, "transactions")}
                      style={styles.iconBtn}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.danger}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={styles.bentoRow}>
                <View
                  style={[styles.bentoBoxHalf, { borderColor: theme.success }]}
                >
                  <Text style={styles.bentoLabel}>OWED TO ME</Text>
                  <Text style={[styles.bentoValueSm, { color: theme.success }]}>
                    Rs {owedToMe.toLocaleString()}
                  </Text>
                </View>
                <View
                  style={[styles.bentoBoxHalf, { borderColor: theme.warning }]}
                >
                  <Text style={styles.bentoLabel}>I OWE</Text>
                  <Text style={[styles.bentoValueSm, { color: theme.warning }]}>
                    Rs {iOwe.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionHeading}>ACTIVE DEBTS</Text>
              {searchFilteredDebts.map((d) => (
                <View key={d._id} style={styles.tRow}>
                  <View style={styles.tInfo}>
                    <Text style={styles.tDesc}>{d.person}</Text>
                    <Text style={styles.tCat}>
                      {d.type === "lent" ? "You Lent" : "You Borrowed"}
                    </Text>
                  </View>

                  <View style={styles.actionGroup}>
                    <Text
                      style={[
                        styles.tAmount,
                        {
                          color:
                            d.type === "lent" ? theme.success : theme.warning,
                        },
                      ]}
                    >
                      Rs {d.amount.toLocaleString()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleDebtStatus(d._id, d.status)}
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            d.status.toLowerCase() === "pending"
                              ? theme.warning + "20"
                              : theme.success + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color:
                              d.status.toLowerCase() === "pending"
                                ? theme.warning
                                : theme.success,
                          },
                        ]}
                      >
                        {d.status.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => promptDelete(d._id, "debts")}
                      style={styles.iconBtn}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.danger}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    topTabs: {
      flexDirection: "row",
      marginHorizontal: 24,
      marginBottom: 16,
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: 16,
    },
    tabBtnActive: { backgroundColor: theme.invertedBg },
    tabText: { fontSize: 14, fontWeight: "800", color: theme.subtext },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      marginHorizontal: 24,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: { flex: 1, marginLeft: 10, color: theme.text, fontSize: 14 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    monthNav: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    monthText: { fontSize: 16, fontWeight: "800", color: theme.text },
    bentoBoxFull: {
      padding: 20,
      borderRadius: 24,
      backgroundColor: theme.invertedBg,
      alignItems: "center",
      marginBottom: 20,
    },
    bentoRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
    bentoBoxHalf: {
      flex: 1,
      padding: 15,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
    },
    bentoLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1,
    },
    bentoValueLg: {
      fontSize: 32,
      fontWeight: "900",
      color: theme.invertedText,
      marginTop: 4,
    },
    bentoValueSm: { fontSize: 18, fontWeight: "800", marginTop: 4 },
    sectionHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.subtext,
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    tRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tInfo: { flex: 1 },
    tDesc: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 2,
    },
    tCat: { fontSize: 12, color: theme.subtext },
    actionGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconBtn: { padding: 4 },
    tAmount: { fontSize: 16, fontWeight: "800" },
    statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: "800" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalBox: {
      width: "100%",
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalIconBg: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.danger + "15",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    modalSub: {
      fontSize: 14,
      color: theme.subtext,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
    },
    modalActions: { flexDirection: "row", gap: 12, width: "100%" },
    modalBtnCancel: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    modalBtnTextCancel: { color: theme.text, fontWeight: "700", fontSize: 15 },
    modalBtnDelete: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: theme.danger,
      alignItems: "center",
    },
    modalBtnTextDelete: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  });
