import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";

const Colors = {
  light: {
    background: "#FFFFFF",
    text: "#000000",
    subtext: "#737373",
    border: "#E5E5E5",
    inputBg: "#FAFAFA",
    buttonBg: "#000000",
    buttonText: "#FFFFFF",
    errorBg: "#FEF2F2",
    errorText: "#EF4444",
    successBg: "#F0FDF4",
    successText: "#10B981",
    otpActiveBorder: "#000000",
  },
  dark: {
    background: "#000000",
    text: "#FFFFFF",
    subtext: "#A3A3A3",
    border: "#262626",
    inputBg: "#0A0A0A",
    buttonBg: "#FFFFFF",
    buttonText: "#000000",
    errorBg: "#450A0A",
    errorText: "#F87171",
    successBg: "#064E3B",
    successText: "#34D399",
    otpActiveBorder: "#FFFFFF",
  },
};

export default function LoginScreen() {
  const router = useRouter();
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  // --- UI States ---
  const [mode, setMode] = useState<"login" | "forgot_email" | "forgot_reset">(
    "login",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // --- Form States ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // --- Reset Password States ---
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- Refs (This fixes the "fast dot" password glitch) ---
  const passwordRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // --- 1. Main Login Handler ---
  const handleLogin = async () => {
    Keyboard.dismiss();
    setMessage({ type: "", text: "" });
    if (!email || !password)
      return setMessage({ type: "error", text: "Please fill in all fields." });

    setIsLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/login`, {
        email: email.trim(),
        password,
      });
      await AsyncStorage.setItem("userToken", response.data.token);

      // Clear the physical input box
      passwordRef.current?.clear();
      setPassword("");

      router.replace("/(tabs)");
    } catch (error: any) {
      if (error.response && error.response.status === 400) {
        setMessage({ type: "error", text: "Invalid email or password." });
      } else {
        setMessage({ type: "error", text: "Could not connect to the server." });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. Request OTP Handler ---
  const handleRequestOTP = async () => {
    Keyboard.dismiss();
    setMessage({ type: "", text: "" });
    if (!email)
      return setMessage({
        type: "error",
        text: "Please enter your email address first.",
      });

    setIsLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/forgot-password`, {
        email: email.trim(),
      });
      setMessage({
        type: "success",
        text: "OTP sent! Please check your email.",
      });
      setMode("forgot_reset");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Error sending OTP.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. Reset Password Handler ---
  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setMessage({ type: "", text: "" });

    if (resetOtp.length !== 6)
      return setMessage({
        type: "error",
        text: "Please enter a valid 6-digit OTP.",
      });
    if (!newPassword || !confirmPassword)
      return setMessage({
        type: "error",
        text: "Please enter and confirm your new password.",
      });
    if (newPassword !== confirmPassword)
      return setMessage({ type: "error", text: "Passwords do not match." });

    setIsLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/reset-password`, {
        email: email.trim(),
        otp: resetOtp.trim(),
        newPassword,
      });
      setMessage({
        type: "success",
        text: "Password reset successfully! You can now log in.",
      });

      // Clear the state AND the physical input boxes
      setPassword("");
      setResetOtp("");
      setNewPassword("");
      setConfirmPassword("");
      passwordRef.current?.clear();
      newPasswordRef.current?.clear();
      confirmPasswordRef.current?.clear();

      setMode("login");
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Invalid OTP or error resetting password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openWebPortal = () => {
    Linking.openURL("https://myportalucp.online/");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContainer}>
            <View style={styles.iconWrapper}>
              <Ionicons name="school-outline" size={40} color={theme.text} />
            </View>
            <Text style={styles.title}>
              {mode === "login" ? "Portal Access" : "Reset Password"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "login"
                ? "Sign in to your university workspace"
                : "Recover access to your account"}
            </Text>
          </View>

          <View style={styles.formContainer}>
            {message.text ? (
              <View
                style={[
                  styles.messageContainer,
                  message.type === "success"
                    ? styles.successBg
                    : styles.errorBg,
                ]}
              >
                <Ionicons
                  name={
                    message.type === "success"
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={18}
                  color={
                    message.type === "success"
                      ? theme.successText
                      : theme.errorText
                  }
                />
                <Text
                  style={[
                    styles.messageText,
                    {
                      color:
                        message.type === "success"
                          ? theme.successText
                          : theme.errorText,
                    },
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            ) : null}

            {/* ======================= LOGIN MODE ======================= */}
            {mode === "login" && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="student@ucp.edu.pk"
                      placeholderTextColor={theme.subtext}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        setMessage({ type: "", text: "" });
                      }}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    {/* UNCONTROLLED COMPONENT: Removed value={password} and added ref */}
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showPassword}
                      onChangeText={(t) => {
                        setPassword(t);
                        setMessage({ type: "", text: "" });
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={theme.subtext}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.forgotPassword}
                  onPress={() => {
                    setMode("forgot_email");
                    setMessage({ type: "", text: "" });
                  }}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.buttonText} />
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ======================= FORGOT PASSWORD: STEP 1 ======================= */}
            {mode === "forgot_email" && (
              <>
                <Text style={styles.instructions}>
                  Enter your registered email address. We will send a 6-digit
                  OTP to verify your identity.
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="student@ucp.edu.pk"
                      placeholderTextColor={theme.subtext}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        setMessage({ type: "", text: "" });
                      }}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleRequestOTP}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.buttonText} />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setMode("login")}
                >
                  <Text style={styles.backButtonText}>Back to Login</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ======================= FORGOT PASSWORD: STEP 2 ======================= */}
            {mode === "forgot_reset" && (
              <>
                <Text style={styles.instructions}>
                  An OTP has been sent to {email}.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>6-Digit OTP</Text>
                  <View style={styles.otpContainer}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <View
                        key={index}
                        style={[
                          styles.otpBox,
                          resetOtp.length === index && styles.otpBoxActive,
                        ]}
                      >
                        <Text style={styles.otpText}>
                          {resetOtp[index] || ""}
                        </Text>
                      </View>
                    ))}
                    <TextInput
                      style={styles.hiddenOtpInput}
                      value={resetOtp}
                      onChangeText={(t) => {
                        setResetOtp(t.replace(/[^0-9]/g, ""));
                        setMessage({ type: "", text: "" });
                      }}
                      maxLength={6}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    {/* UNCONTROLLED COMPONENT */}
                    <TextInput
                      ref={newPasswordRef}
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showPassword}
                      onChangeText={(t) => {
                        setNewPassword(t);
                        setMessage({ type: "", text: "" });
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={theme.subtext}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    {/* UNCONTROLLED COMPONENT */}
                    <TextInput
                      ref={confirmPasswordRef}
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showConfirmPassword}
                      onChangeText={(t) => {
                        setConfirmPassword(t);
                        setMessage({ type: "", text: "" });
                      }}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={
                          showConfirmPassword
                            ? "eye-off-outline"
                            : "eye-outline"
                        }
                        size={20}
                        color={theme.subtext}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.buttonText} />
                  ) : (
                    <Text style={styles.buttonText}>Confirm New Password</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setMode("login")}
                >
                  <Text style={styles.backButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.footerBox}>
            <Text style={styles.footerHeading}>Don't have an account?</Text>
            <Text style={styles.footerText}>
              Account creation is exclusively managed through our web platform.
            </Text>
            <TouchableOpacity onPress={openWebPortal} style={styles.linkButton}>
              <Text style={styles.linkText}>
                Create Account at myportalucp.online
              </Text>
              <Ionicons name="open-outline" size={16} color={theme.text} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingTop: 60,
      paddingBottom: 120,
      backgroundColor: theme.background,
    },
    headerContainer: { alignItems: "flex-start", marginBottom: 35 },
    iconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 36,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
      letterSpacing: -1,
    },
    subtitle: { fontSize: 16, color: theme.subtext, fontWeight: "500" },
    instructions: {
      fontSize: 14,
      color: theme.subtext,
      marginBottom: 20,
      lineHeight: 22,
    },
    formContainer: { width: "100%" },
    messageContainer: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
      gap: 10,
      borderWidth: 1,
    },
    errorBg: {
      backgroundColor: theme.errorBg,
      borderColor: "rgba(239, 68, 68, 0.2)",
    },
    successBg: {
      backgroundColor: theme.successBg,
      borderColor: "rgba(16, 185, 129, 0.2)",
    },
    messageText: { fontSize: 14, fontWeight: "600", flex: 1 },
    inputGroup: { marginBottom: 20 },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      height: 56,
      paddingHorizontal: 16,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, color: theme.text, fontSize: 16, height: "100%" },
    eyeIcon: { padding: 4 },

    otpContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      position: "relative",
      height: 56,
    },
    otpBox: {
      flex: 1,
      marginHorizontal: 4,
      height: 56,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    otpBoxActive: { borderColor: theme.otpActiveBorder, borderWidth: 2 },
    otpText: { fontSize: 24, fontWeight: "bold", color: theme.text },
    hiddenOtpInput: {
      position: "absolute",
      width: "100%",
      height: "100%",
      opacity: 0,
    },

    forgotPassword: { alignSelf: "flex-start", marginBottom: 32 },
    forgotText: {
      color: theme.subtext,
      fontSize: 14,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    button: {
      backgroundColor: theme.buttonBg,
      height: 56,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: { color: theme.buttonText, fontSize: 16, fontWeight: "bold" },
    backButton: { marginTop: 20, alignItems: "center" },
    backButtonText: { color: theme.subtext, fontSize: 15, fontWeight: "600" },

    footerBox: {
      marginTop: 50,
      padding: 20,
      backgroundColor: theme.inputBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    footerHeading: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 6,
    },
    footerText: {
      fontSize: 14,
      color: theme.subtext,
      lineHeight: 22,
      marginBottom: 15,
    },
    linkButton: { flexDirection: "row", alignItems: "center", gap: 6 },
    linkText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "bold",
      textDecorationLine: "underline",
    },
  });
