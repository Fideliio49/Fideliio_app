import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/Input";
import { FideliioLogo } from "@/components/FideliioLogo";

export default function LoginScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: "customer" | "merchant" }>();
  const { setUser, language, completeOnboarding } = useApp();
  const { registerCustomer, registerMerchant } = useData();

  const isMerchant = role === "merchant";
  const accent = isMerchant ? colors.blue : colors.coral;
  const gradientColors: [string, string] = isMerchant
    ? ["#2C3E8C", "#00B4D8"]
    : ["#FF6B6B", "#FF8E53"];

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSendOtp() {
    if (!phone.trim()) { setErrors({ phone: "Required" }); return; }
    setOtpSent(true);
  }

  async function handleLogin() {
    const errs: Record<string, string> = {};
    if (mode === "email") {
      if (!email.trim()) errs.email = "Required";
      if (!password.trim()) errs.password = "Required";
    } else {
      if (!phone.trim()) errs.phone = "Required";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      const userId = `user_${Date.now()}`;
      const mockUser = {
        id: userId,
        role: role as "customer" | "merchant",
        firstName: isMerchant ? "Commerçant" : "Client",
        lastName: "Demo",
        email: mode === "email" ? email : undefined,
        phone: mode === "phone" ? phone : undefined,
        language,
        businessName: isMerchant ? "Mon Commerce" : undefined,
        businessCategory: isMerchant ? "restaurant" : undefined,
        pointsRate: isMerchant ? 1 : undefined,
        totalPoints: isMerchant ? undefined : 250,
      };

      if (!isMerchant) {
        await registerCustomer({
          userId,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          email: mockUser.email,
          phone: mockUser.phone,
          totalPoints: 250,
        });
      } else {
        await registerMerchant({
          userId,
          businessName: "Mon Commerce",
          category: "restaurant",
          pointsRate: 1,
        });
      }
      setUser(mockUser);
      await completeOnboarding();
      router.replace(isMerchant ? "/(merchant)/home" : "/(customer)/home");
    } catch {
      Alert.alert("Error", "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: "#fff" }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Platform.OS === "web" ? 80 : 60 }]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.header}>
          <FideliioLogo size={52} />
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("auth.login")}
          </Text>
        </View>

        {/* Tab switcher */}
        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          {(["email", "phone"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => { setMode(m); setErrors({}); }}
              style={[styles.tab, { borderBottomColor: mode === m ? accent : "transparent", borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, {
                color: mode === m ? accent : colors.mutedForeground,
                fontFamily: mode === m ? "Inter_600SemiBold" : "Inter_400Regular",
              }]}>
                {m === "email" ? t("auth.email") : t("auth.phone")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.form}>
          {mode === "email" ? (
            <>
              <Input
                label={t("auth.email")}
                placeholder="email@exemple.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail"
                error={errors.email}
              />
              <Input
                label={t("auth.password")}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                leftIcon="lock"
                rightIcon={showPassword ? "eye-off" : "eye"}
                onRightIconPress={() => setShowPassword((v) => !v)}
                error={errors.password}
              />
              <TouchableOpacity
                onPress={() => router.push(`/auth/forgot?role=${role}`)}
                style={styles.forgotBtn}
              >
                <Text style={[styles.forgotText, { color: accent, fontFamily: "Inter_400Regular" }]}>
                  {t("auth.forgotPassword")}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Input
                label={t("auth.phone")}
                placeholder="+212 6XX XXX XXX"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                leftIcon="smartphone"
                error={errors.phone}
              />
              {!otpSent ? (
                <TouchableOpacity
                  onPress={handleSendOtp}
                  style={[styles.otpBtn, { borderColor: accent, borderRadius: colors.radius }]}
                >
                  <Text style={[{ color: accent, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>
                    {t("auth.sendOtp")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Input
                  label={t("auth.otp")}
                  placeholder="123456"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  leftIcon="shield"
                />
              )}
            </>
          )}
        </View>

        <TouchableOpacity onPress={handleLogin} activeOpacity={0.88} disabled={loading}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaBtn, { borderRadius: colors.radius }]}
          >
            <Text style={[styles.ctaText, { fontFamily: "Inter_600SemiBold" }]}>
              {loading ? t("common.loading") : t("auth.login")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("common.or")}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity style={[styles.googleBtn, { borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={[styles.googleText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
            {t("auth.google")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push(`/auth/register?role=${role}`)}
          style={styles.registerLink}
        >
          <Text style={[styles.registerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("auth.noAccount")}{" "}
            <Text style={{ color: accent, fontFamily: "Inter_600SemiBold" }}>
              {t("auth.signUp")}
            </Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  backBtn: { marginBottom: 16 },
  header: { alignItems: "center", gap: 12, marginBottom: 28 },
  title: { fontSize: 22 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 20 },
  tab: { flex: 1, alignItems: "center", paddingBottom: 10 },
  tabText: { fontSize: 15 },
  form: {},
  forgotBtn: { alignSelf: "flex-end", marginBottom: 16, marginTop: 4 },
  forgotText: { fontSize: 14 },
  otpBtn: { borderWidth: 1.5, paddingVertical: 13, alignItems: "center", marginBottom: 12 },
  ctaBtn: { paddingVertical: 16, alignItems: "center", marginTop: 4 },
  ctaText: { color: "#fff", fontSize: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 14 },
  googleBtn: {
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  googleIcon: { fontSize: 18, fontWeight: "bold", color: "#4285F4" },
  googleText: { fontSize: 15 },
  registerLink: { alignItems: "center", marginTop: 20, marginBottom: 16 },
  registerText: { fontSize: 15 },
});
