import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { FideliioLogo } from "@/components/FideliioLogo";
import { sendPhoneOTP, verifyPhoneOTP } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid/non-secure";

const CATEGORIES = [
  "restaurant",
  "clothing",
  "hairSalon",
  "hotel",
  "other",
] as const;

export default function RegisterScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: "customer" | "merchant" }>();
  const { completeOnboarding } = useApp();

  const isMerchant = role === "merchant";
  const accent = isMerchant ? colors.blue : colors.coral;
  const gradientColors: [string, string] = isMerchant
    ? ["#2C3E8C", "#00B4D8"]
    : ["#FF6B6B", "#FF8E53"];

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [phoneStep, setPhoneStep] = useState<"form" | "otp">("form");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string>("restaurant");
  const [otpCode, setOtpCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dest = isMerchant ? "/(merchant)/home" : "/(customer)/home";

  async function handleRegister() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim()) errs.lastName = "Required";
    if (mode === "email") {
      if (!email.trim()) errs.email = t("auth.atLeastOne");
      if (!password.trim()) errs.password = "Required";
      if (password.length < 6) errs.password = "Au moins 6 caractères";
      if (password !== confirmPw) errs.confirmPw = t("auth.passwordsMatch");
    } else {
      if (!phone.trim()) errs.phone = t("auth.atLeastOne");
    }
    if (isMerchant && !businessName.trim()) errs.businessName = "Required";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      if (mode === "email") {
        // ── 1. Créer le compte auth avec role dans les metadata ──
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email: email.trim(),
            password,
            options: {
              data: {
                role, // ✅ sauvegarde le role
                first_name: firstName,
                last_name: lastName,
                firstName, // ✅ pour buildUserFromSession
                lastName,
                businessName: isMerchant ? businessName : undefined,
                businessCategory: isMerchant ? category : undefined,
                pointsRate: isMerchant ? 1 : undefined,
              },
            },
          },
        );
        if (authError) throw authError;

        const userId = authData.user!.id;
        const qrCode = isMerchant
          ? `FID-MERCH-${nanoid(8).toUpperCase()}`
          : `FID-CUST-${nanoid(8).toUpperCase()}`;

        // ── 2. Insérer dans la bonne table selon le role ──
        if (isMerchant) {
          // Vérifier qu'il n'existe pas déjà (évite les doublons)
          const { data: existing } = await supabase
            .from("merchants")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (!existing) {
            const { error: insertError } = await supabase
              .from("merchants")
              .insert({
                id: nanoid(),
                user_id: userId,
                business_name: businessName.trim(),
                category,
                logo_url: null,
                points_rate: 1,
                qr_code: qrCode,
              });
            if (insertError) throw insertError;
          }
        } else {
          // Vérifier qu'il n'existe pas déjà
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (!existing) {
            const { error: insertError } = await supabase
              .from("customers")
              .insert({
                id: nanoid(),
                user_id: userId,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim(),
                phone: phone || null,
                tier: "bronze",
                qr_code: qrCode,
              });
            if (insertError) throw insertError;
          }
        }

        await completeOnboarding();
        router.replace(dest as any);
      } else {
        // ── Mode téléphone → OTP ──
        await sendPhoneOTP(phone.trim());
        setPhoneStep("otp");
        setErrors({});
      }
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered")
      ) {
        Alert.alert("Erreur", "Cet email est déjà utilisé.");
      } else {
        Alert.alert("Erreur", msg || "Inscription échouée.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode.trim()) {
      setErrors({ otp: "Required" });
      return;
    }

    setLoading(true);
    try {
      const userData = isMerchant
        ? { firstName, lastName, businessName, category, pointsRate: 1 }
        : { firstName, lastName, phone: phone || undefined };

      await verifyPhoneOTP(
        phone.trim(),
        otpCode.trim(),
        userData,
        role ?? "customer",
      );
      await completeOnboarding();
      router.replace(dest as any);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Code incorrect.");
    } finally {
      setLoading(false);
    }
  }

  if (phoneStep === "otp") {
    return (
      <View style={[styles.container, { backgroundColor: "#fff" }]}>
        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: Platform.OS === "web" ? 80 : 60 },
          ]}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          bottomOffset={20}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => setPhoneStep("form")}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color="#0f0f0f" />
          </TouchableOpacity>

          <View style={styles.header}>
            <FideliioLogo size={52} />
            <Text
              style={[
                styles.title,
                { color: "#0f0f0f", fontFamily: "Inter_700Bold" },
              ]}
            >
              Vérification
            </Text>
            <Text
              style={[
                {
                  color: "#6B7280",
                  fontSize: 14,
                  textAlign: "center",
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              Code envoyé à {mode === "email" ? email : phone}
            </Text>
          </View>

          <Input
            label={t("auth.otp")}
            placeholder="123456"
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            leftIcon="shield"
            error={errors.otp}
          />

          <TouchableOpacity
            onPress={handleVerifyOtp}
            activeOpacity={0.88}
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.ctaBtn, { borderRadius: colors.radius }]}
            >
              <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
                {loading ? t("common.loading") : "Vérifier"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              try {
                await sendPhoneOTP(phone.trim());
                Alert.alert("OK", "Code renvoyé !");
              } catch {
                Alert.alert("Erreur", "Impossible de renvoyer le code.");
              }
            }}
            style={styles.resendBtn}
          >
            <Text
              style={[
                {
                  color: accent,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                },
              ]}
            >
              Renvoyer le code
            </Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#fff" }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Platform.OS === "web" ? 80 : 60 },
        ]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#0f0f0f" />
        </TouchableOpacity>

        <View style={styles.header}>
          <FideliioLogo size={52} />
          <Text
            style={[
              styles.title,
              { color: "#0f0f0f", fontFamily: "Inter_700Bold" },
            ]}
          >
            {isMerchant ? t("auth.registerMerchant") : t("auth.register")}
          </Text>
        </View>

        <View style={styles.row2}>
          <Input
            label={t("auth.firstName")}
            placeholder={t("auth.firstName")}
            value={firstName}
            onChangeText={setFirstName}
            leftIcon="user"
            error={errors.firstName}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label={t("auth.lastName")}
            placeholder={t("auth.lastName")}
            value={lastName}
            onChangeText={setLastName}
            leftIcon="user"
            error={errors.lastName}
            containerStyle={{ flex: 1 }}
          />
        </View>

        <View style={[styles.tabRow, { borderBottomColor: "#E5E7EB" }]}>
          {(["email", "phone"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => {
                setMode(m);
                setErrors({});
              }}
              style={[
                styles.tab,
                {
                  borderBottomColor: mode === m ? accent : "transparent",
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: mode === m ? accent : "#6B7280",
                    fontFamily:
                      mode === m ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {m === "email" ? t("auth.email") : t("auth.phone")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === "email" ? (
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
        ) : (
          <Input
            label={t("auth.phone")}
            placeholder="+212 6XX XXX XXX"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="smartphone"
            error={errors.phone}
          />
        )}

        {mode === "email" && (
          <>
            <Input
              label={t("auth.password")}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              leftIcon="lock"
              rightIcon={showPw ? "eye-off" : "eye"}
              onRightIconPress={() => setShowPw((v) => !v)}
              error={errors.password}
            />
            <Input
              label={t("auth.confirmPassword")}
              placeholder="••••••••"
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry={!showConfirmPw}
              leftIcon="lock"
              rightIcon={showConfirmPw ? "eye-off" : "eye"}
              onRightIconPress={() => setShowConfirmPw((v) => !v)}
              error={errors.confirmPw}
            />
          </>
        )}

        {isMerchant && (
          <>
            <Input
              label={t("auth.businessName")}
              placeholder={t("auth.businessName")}
              value={businessName}
              onChangeText={setBusinessName}
              leftIcon="briefcase"
              error={errors.businessName}
            />
            <Text
              style={[
                styles.catLabel,
                { color: "#6B7280", fontFamily: "Inter_500Medium" },
              ]}
            >
              {t("auth.businessCategory")}
            </Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.catBtn,
                    {
                      borderRadius: colors.radius,
                      borderColor: category === cat ? accent : "#E5E7EB",
                      backgroundColor:
                        category === cat
                          ? isMerchant
                            ? colors.tealLight
                            : colors.coralLight
                          : "#fff",
                      borderWidth: category === cat ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catText,
                      {
                        color: category === cat ? accent : "#6B7280",
                        fontFamily:
                          category === cat
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                      },
                    ]}
                  >
                    {t(`auth.categories.${cat}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={handleRegister}
          activeOpacity={0.88}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaBtn, { borderRadius: colors.radius }]}
          >
            <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
              {loading
                ? t("common.loading")
                : mode === "phone"
                  ? "Envoyer le code"
                  : "Créer un compte"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: "#E5E7EB" }]} />
          <Text
            style={[
              styles.dividerText,
              { color: "#6B7280", fontFamily: "Inter_400Regular" },
            ]}
          >
            {t("common.or")}
          </Text>
          <View style={[styles.divider, { backgroundColor: "#E5E7EB" }]} />
        </View>

        <TouchableOpacity
          style={[styles.googleBtn, { borderRadius: colors.radius }]}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={[styles.googleText, { fontFamily: "Inter_500Medium" }]}>
            {t("auth.google")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.loginLink}
        >
          <Text
            style={[
              styles.loginText,
              { color: "#6B7280", fontFamily: "Inter_400Regular" },
            ]}
          >
            {t("auth.haveAccount")}{" "}
            <Text style={[{ color: accent, fontFamily: "Inter_600SemiBold" }]}>
              {t("auth.signIn")}
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
  header: { alignItems: "center", gap: 12, marginBottom: 24 },
  title: { fontSize: 22 },
  row2: { flexDirection: "row", gap: 12 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 16 },
  tab: { flex: 1, alignItems: "center", paddingBottom: 10 },
  tabText: { fontSize: 15 },
  catLabel: { fontSize: 13, marginBottom: 8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  catText: { fontSize: 13 },
  ctaBtn: { paddingVertical: 16, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 14 },
  googleBtn: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  googleIcon: { fontSize: 18, fontWeight: "bold", color: "#4285F4" },
  googleText: { fontSize: 15, color: "#0f0f0f" },
  loginLink: { alignItems: "center", marginTop: 20, marginBottom: 20 },
  loginText: { fontSize: 15 },
  resendBtn: { alignItems: "center", marginTop: 20 },
});
