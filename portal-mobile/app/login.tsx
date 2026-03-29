import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import the PortalSync component for the post-login cookie refresh
import PortalSync from "../components/PortalSync";

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
    brand: "#4f46e5",
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
    brand: "#3B82F6",
  },
};

export default function LoginScreen() {
  const router = useRouter();
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === "android" ? 24 : insets.top;

  const [mode, setMode] = useState<
    "login" | "forgot_email" | "forgot_reset" | "register" | "register_verify"
  >("login");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- POST-LOGIN SYNC STATE ---
  const [showPortalSync, setShowPortalSync] = useState(false);
  const [jwtToken, setJwtToken] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null); // Ref for the hidden OTP input

  const buttonRadarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(buttonRadarAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      buttonRadarAnim.setValue(0);
      buttonRadarAnim.stopAnimation();
    }
  }, [isLoading]);

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // ==========================================
  // 1. LOGIN & POST-LOGIN SYNC CHECK
  // ==========================================
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
      const token = response.data.token;
      await AsyncStorage.setItem("userToken", token);
      setJwtToken(token);

      passwordRef.current?.clear();
      setPassword("");

      setIsLoading(false);
      setIsSuccess(true);

      // Trigger the Microsoft Connect Portal immediately after success
      setTimeout(() => {
        setIsSuccess(false);
        setShowPortalSync(true);
      }, 1000);
    } catch (error: any) {
      setIsLoading(false);
      if (error.response && error.response.status === 400) {
        setMessage({ type: "error", text: "Invalid email or password." });
      } else {
        setMessage({ type: "error", text: "Could not connect to the server." });
      }
    }
  };

  // ==========================================
  // 2. REGISTRATION FLOW
  // ==========================================
  const handleRegisterInitiate = async () => {
    Keyboard.dismiss();
    setMessage({ type: "", text: "" });

    if (!name || !email || !password || !confirmPassword) {
      return setMessage({ type: "error", text: "Please fill in all fields." });
    }
    if (password !== confirmPassword) {
      return setMessage({ type: "error", text: "Passwords do not match." });
    }

    setIsLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/send-otp`, { email: email.trim() });
      setMessage({
        type: "success",
        text: "Verification code sent! Please check your email.",
      });
      setMode("register_verify");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Error sending code.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterVerify = async () => {
    Keyboard.dismiss();
    setMessage({ type: "", text: "" });
    if (!otpCode || otpCode.length !== 6)
      return setMessage({
        type: "error",
        text: "Please enter a valid 6-digit code.",
      });

    setIsLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/register`, {
        name: name.trim(),
        email: email.trim(),
        password,
        otp: otpCode.trim(),
      });

      const token = response.data.token;
      await AsyncStorage.setItem("userToken", token);
      setJwtToken(token);

      setIsLoading(false);
      setIsSuccess(true);

      // Trigger the Microsoft Connect Portal immediately after new registration
      setTimeout(() => {
        setIsSuccess(false);
        setShowPortalSync(true);
      }, 1000);
    } catch (error: any) {
      setIsLoading(false);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Invalid code or registration failed.",
      });
    }
  };

  // ==========================================
  // 3. FORGOT PASSWORD FLOW
  // ==========================================
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
        text: "Reset code sent! Please check your email.",
      });
      setMode("forgot_reset");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Error sending code.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setMessage({ type: "", text: "" });

    if (otpCode.length !== 6)
      return setMessage({
        type: "error",
        text: "Please enter a valid 6-digit code.",
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
        otp: otpCode.trim(),
        newPassword,
      });
      setMessage({
        type: "success",
        text: "Password reset successfully! You can now log in.",
      });

      setPassword("");
      setOtpCode("");
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
          "Invalid code or error resetting password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setMessage({ type: "", text: "" });
    if (mode === "login") {
      setMode("register");
    } else {
      setMode("login");
    }
  };

  // Helper to render the 6-box OTP UI
  const renderOTPBoxes = () => {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Verification Code</Text>

        {/* Interactive Boxes mapping to hidden input */}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.otpContainer}
          onPress={() => otpInputRef.current?.focus()}
        >
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const digit = otpCode[index] || "";
            // Highlight the next empty box, or the last box if full
            const isCurrent =
              otpCode.length === index || (otpCode.length === 6 && index === 5);
            return (
              <View
                key={index}
                style={[styles.otpBox, isCurrent && styles.otpBoxActive]}
              >
                <Text style={styles.otpText}>{digit}</Text>
              </View>
            );
          })}
        </TouchableOpacity>

        {/* Hidden Input that handles the actual keyboard interactions natively */}
        <TextInput
          ref={otpInputRef}
          style={styles.hiddenInput}
          value={otpCode}
          onChangeText={(t) => {
            setOtpCode(t.replace(/[^0-9]/g, ""));
            setMessage({ type: "", text: "" });
          }}
          maxLength={6}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus={true}
        />
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* --- POST-LOGIN SYNC INTERCEPT MODAL --- */}
        <Modal
          visible={showPortalSync}
          animationType="slide"
          presentationStyle="pageSheet"
          statusBarTranslucent={true}
          onRequestClose={() => {
            setShowPortalSync(false);
            router.replace("/(tabs)");
          }}
        >
          <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View
              style={[styles.modalHeader, { paddingTop: statusBarHeight + 10 }]}
            >
              <View style={{ width: 80 }} />
              <View style={styles.modalTitleContainer}>
                <Ionicons name="sync-circle" size={20} color={theme.text} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  University Link
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowPortalSync(false);
                  router.replace("/(tabs)");
                }}
              >
                <Text style={styles.modalCloseText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
            {jwtToken && (
              <PortalSync
                jwtToken={jwtToken}
                onSyncComplete={() => {
                  setShowPortalSync(false);
                  router.replace("/(tabs)");
                }}
              />
            )}
          </View>
        </Modal>

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
              {mode === "login"
                ? "Portal Access"
                : mode === "register"
                  ? "Create Account"
                  : mode === "register_verify"
                    ? "Verify Email"
                    : "Reset Password"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "login"
                ? "Sign in to your university workspace"
                : mode === "register"
                  ? "Join MyPortal to manage your academics"
                  : mode === "register_verify"
                    ? "Enter the code sent to your email"
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

            {/* --- REGISTER MODE --- */}
            {mode === "register" && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor={theme.subtext}
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        setMessage({ type: "", text: "" });
                      }}
                    />
                  </View>
                </View>

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
                      placeholder="name@university.edu"
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
                    <TextInput
                      style={styles.input}
                      placeholder="Create a strong password"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      /* REMOVED value={password} to fix Android typing bug */
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

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={confirmPasswordRef}
                      style={styles.input}
                      placeholder="Confirm your password"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      /* REMOVED value={confirmPassword} to fix Android typing bug */
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
                  style={[styles.button, { marginTop: 15 }]}
                  onPress={handleRegisterInitiate}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={styles.buttonLoaderContainer}>
                      <Animated.View
                        style={[
                          styles.buttonRadar,
                          {
                            backgroundColor: theme.buttonText,
                            opacity: buttonRadarAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 0],
                            }),
                            transform: [
                              {
                                scale: buttonRadarAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.5, 2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.buttonCore,
                          { backgroundColor: theme.buttonText },
                        ]}
                      />
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* --- REGISTER VERIFY MODE --- */}
            {mode === "register_verify" && (
              <>
                {renderOTPBoxes()}
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleRegisterVerify}
                  disabled={isLoading || isSuccess}
                >
                  {isSuccess ? (
                    <Ionicons name="checkmark-done" size={28} color="#FFFFFF" />
                  ) : isLoading ? (
                    <View style={styles.buttonLoaderContainer}>
                      <Animated.View
                        style={[
                          styles.buttonRadar,
                          {
                            backgroundColor: theme.buttonText,
                            opacity: buttonRadarAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 0],
                            }),
                            transform: [
                              {
                                scale: buttonRadarAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.5, 2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.buttonCore,
                          { backgroundColor: theme.buttonText },
                        ]}
                      />
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setMode("register")}
                >
                  <Text style={styles.backButtonText}>Back to Sign Up</Text>
                </TouchableOpacity>
              </>
            )}

            {/* --- LOGIN MODE --- */}
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
                      placeholder="name@university.edu"
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
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      /* REMOVED value={password} to fix Android typing bug */
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
                  style={[
                    styles.button,
                    isSuccess && { backgroundColor: theme.successText },
                  ]}
                  onPress={handleLogin}
                  disabled={isLoading || isSuccess}
                >
                  {isSuccess ? (
                    <Ionicons name="checkmark-done" size={28} color="#FFFFFF" />
                  ) : isLoading ? (
                    <View style={styles.buttonLoaderContainer}>
                      <Animated.View
                        style={[
                          styles.buttonRadar,
                          {
                            backgroundColor: theme.buttonText,
                            opacity: buttonRadarAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 0],
                            }),
                            transform: [
                              {
                                scale: buttonRadarAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.5, 2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.buttonCore,
                          { backgroundColor: theme.buttonText },
                        ]}
                      />
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* --- FORGOT EMAIL MODE --- */}
            {mode === "forgot_email" && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Registered Email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="name@university.edu"
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
                    <View style={styles.buttonLoaderContainer}>
                      <Animated.View
                        style={[
                          styles.buttonRadar,
                          {
                            backgroundColor: theme.buttonText,
                            opacity: buttonRadarAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 0],
                            }),
                            transform: [
                              {
                                scale: buttonRadarAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.5, 2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.buttonCore,
                          { backgroundColor: theme.buttonText },
                        ]}
                      />
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setMode("login");
                    setMessage({ type: "", text: "" });
                  }}
                >
                  <Text style={styles.backButtonText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            )}

            {/* --- FORGOT RESET MODE --- */}
            {mode === "forgot_reset" && (
              <>
                {renderOTPBoxes()}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={newPasswordRef}
                      style={styles.input}
                      placeholder="Enter new password"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      /* REMOVED value binding to fix typing bug */
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
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={theme.subtext}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={confirmPasswordRef}
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor={theme.subtext}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      /* REMOVED value binding to fix typing bug */
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
                    <View style={styles.buttonLoaderContainer}>
                      <Animated.View
                        style={[
                          styles.buttonRadar,
                          {
                            backgroundColor: theme.buttonText,
                            opacity: buttonRadarAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 0],
                            }),
                            transform: [
                              {
                                scale: buttonRadarAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.5, 2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.buttonCore,
                          { backgroundColor: theme.buttonText },
                        ]}
                      />
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Update Password</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setMode("login");
                    setMessage({ type: "", text: "" });
                  }}
                >
                  <Text style={styles.backButtonText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* --- DYNAMIC FOOTER --- */}
          {(mode === "login" || mode === "register") && (
            <View style={styles.footerBox}>
              <Text style={styles.footerHeading}>
                {mode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </Text>
              <Text style={styles.footerText}>
                {mode === "login"
                  ? "Join MyPortal to automatically track your academic progress and sync university schedules."
                  : "Sign in to access your synchronized workspace."}
              </Text>
              <TouchableOpacity
                onPress={toggleAuthMode}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>
                  {mode === "login"
                    ? "Create an account now"
                    : "Sign In instead"}
                </Text>
                <Ionicons
                  name="arrow-forward-outline"
                  size={16}
                  color={theme.text}
                />
              </TouchableOpacity>
            </View>
          )}
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
    forgotPassword: { alignSelf: "flex-start", marginBottom: 32 },
    forgotText: {
      color: theme.subtext,
      fontSize: 14,
      fontWeight: "600",
      textDecorationLine: "underline",
    },

    // --- NEW OTP UI STYLES ---
    otpContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 5,
      marginBottom: 10,
    },
    otpBox: {
      width: 48,
      height: 58,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      justifyContent: "center",
      alignItems: "center",
    },
    otpBoxActive: {
      borderColor: theme.brand,
      borderWidth: 2,
    },
    otpText: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.text,
    },
    hiddenInput: {
      position: "absolute",
      width: 1,
      height: 1,
      opacity: 0,
    },

    button: {
      backgroundColor: theme.buttonBg,
      height: 56,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    buttonText: { color: theme.buttonText, fontSize: 16, fontWeight: "bold" },
    buttonLoaderContainer: {
      justifyContent: "center",
      alignItems: "center",
      width: 40,
      height: 40,
    },
    buttonRadar: {
      position: "absolute",
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    buttonCore: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
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

    // Modal UI specific styles
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    modalTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
    },
    modalCloseBtn: {
      width: 100,
      alignItems: "flex-end",
    },
    modalCloseText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.subtext,
    },
  });
