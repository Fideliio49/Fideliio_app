import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Keyboard,
  TextInput,
} from "react-native";
import { fs, sp, iconSize } from "@/utils/responsive";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { FideliioLogo } from "@/components/FideliioLogo";
import { supabase } from "@/lib/supabase";

type Step = "email" | "otp" | "newPassword" | "success";

export default function ForgotScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { language } = useApp();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isMerchant = role === "merchant";
  const gradientColors: [string, string] = isMerchant
    ? ["#2C3E8C", "#00B4D8"]
    : ["#C85A17", "#E67E22"];
  const accent = isMerchant ? "#2C3E8C" : "#C85A17";

  // Labels
  const labelTitle = {
    email:
      language === "ar"
        ? "نسيت كلمة المرور"
        : language === "en"
          ? "Forgot password"
          : "Mot de passe oublié",
    otp:
      language === "ar"
        ? "أدخل الرمز"
        : language === "en"
          ? "Enter the code"
          : "Entrez le code",
    newPassword:
      language === "ar"
        ? "كلمة مرور جديدة"
        : language === "en"
          ? "New password"
          : "Nouveau mot de passe",
    success:
      language === "ar"
        ? "تم بنجاح!"
        : language === "en"
          ? "Done!"
          : "C'est fait !",
  }[step];

  const labelSub = {
    email:
      language === "ar"
        ? "أدخل بريدك الإلكتروني لتلقي رمز التحقق"
        : language === "en"
          ? "Enter your email to receive a verification code"
          : "Entrez votre email pour recevoir un code de vérification",
    otp:
      language === "ar"
        ? `تم إرسال رمز إلى ${email}`
        : language === "en"
          ? `Code sent to ${email}`
          : `Code envoyé à ${email}`,
    newPassword:
      language === "ar"
        ? "اختر كلمة مرور جديدة"
        : language === "en"
          ? "Choose a new password"
          : "Choisissez un nouveau mot de passe",
    success:
      language === "ar"
        ? "تم تغيير كلمة المرور بنجاح"
        : language === "en"
          ? "Your password has been changed"
          : "Votre mot de passe a été modifié",
  }[step];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startResendTimer() {
    setResendTimer(60);
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // ── Étape 1 : Envoyer OTP email ───────────────────────────
  async function handleSendOTP() {
    if (!email.trim()) return;
    if (!isValidEmail(email)) {
      Alert.alert(
        "Erreur",
        language === "ar"
          ? "البريد الإلكتروني غير صحيح"
          : language === "en"
            ? "Invalid email address"
            : "Adresse email invalide",
      );
      return;
    }

    setLoading(true);
    try {
      // ✅ Supabase envoie un OTP email (pas un magic link)
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false, // Ne pas créer de compte si inexistant
        },
      });
      if (error) {
        // Si l'email n'existe pas dans Supabase
        if (
          error.message.includes("not found") ||
          error.message.includes("user")
        ) {
          Alert.alert(
            language === "ar" ? "خطأ" : "Erreur",
            language === "ar"
              ? "هذا البريد الإلكتروني غير مسجل"
              : language === "en"
                ? "This email is not registered"
                : "Cet email n'est pas enregistré",
          );
          return;
        }
        throw error;
      }
      setStep("otp");
      startResendTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 400);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 2 : Vérifier OTP ────────────────────────────────
  async function handleVerifyOTP() {
    const code = otp.join("");
    if (code.length < 6) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "email",
      });
      if (error) throw error;
      // OTP valide → passer à la saisie du nouveau mot de passe
      setStep("newPassword");
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("invalid") || msg.includes("expired")) {
        Alert.alert(
          language === "ar" ? "رمز خاطئ" : "Code invalide",
          language === "ar"
            ? "الرمز غير صحيح أو منتهي الصلاحية"
            : language === "en"
              ? "Invalid or expired code"
              : "Code incorrect ou expiré",
        );
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      } else {
        Alert.alert("Erreur", msg || "Vérification échouée.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 3 : Nouveau mot de passe ───────────────────────
  async function handleUpdatePassword() {
    if (newPassword.length < 6) {
      Alert.alert(
        "Erreur",
        language === "ar"
          ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
          : language === "en"
            ? "Password must be at least 6 characters"
            : "Le mot de passe doit faire au moins 6 caractères",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(
        "Erreur",
        language === "ar"
          ? "كلمتا المرور غير متطابقتين"
          : language === "en"
            ? "Passwords don't match"
            : "Les mots de passe ne correspondent pas",
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setStep("success");
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.message || "Impossible de mettre à jour le mot de passe.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Gestion OTP ───────────────────────────────────────────
  function handleOtpChange(value: string, index: number) {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);
      otpRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  // ── Back handler ──────────────────────────────────────────
  function handleBack() {
    if (step === "otp") {
      setStep("email");
      setOtp(["", "", "", "", "", ""]);
    } else if (step === "newPassword") setStep("otp");
    else router.back();
  }

  // ─────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        {/* Back */}
        {step !== "success" && (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Feather
              name="arrow-left"
              size={iconSize(22)}
              color={colors.foreground}
            />
          </TouchableOpacity>
        )}

        {/* Header */}
        <View style={styles.center}>
          {step === "success" ? (
            <View
              style={[styles.successIconWrap, { backgroundColor: "#27AE6015" }]}
            >
              <Feather
                name="check-circle"
                size={iconSize(48)}
                color="#27AE60"
              />
            </View>
          ) : (
            <FideliioLogo size={52} />
          )}
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {labelTitle}
          </Text>
          <Text
            style={[
              styles.sub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {labelSub}
          </Text>
        </View>

        {/* ── Étape Email ── */}
        {step === "email" && (
          <>
            <Input
              label={t("auth.email")}
              placeholder="email@exemple.com"
              value={email}
              onChangeText={setEmail}
              leftIcon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity
              onPress={handleSendOTP}
              activeOpacity={0.88}
              disabled={loading || !email.trim()}
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.ctaBtn,
                  {
                    borderRadius: colors.radius,
                    opacity: !email.trim() ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.ctaText, { fontFamily: "Inter_600SemiBold" }]}
                >
                  {loading
                    ? t("common.loading")
                    : language === "ar"
                      ? "إرسال الرمز"
                      : language === "en"
                        ? "Send code"
                        : "Envoyer le code"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* ── Étape OTP ── */}
        {step === "otp" && (
          <View style={styles.otpContainer}>
            {/* 6 cases OTP */}
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    otpRefs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handleOtpKeyPress(nativeEvent.key, index)
                  }
                  keyboardType="number-pad"
                  maxLength={6}
                  allowFontScaling={false}
                  selectTextOnFocus
                  style={[
                    styles.otpBox,
                    {
                      borderColor: digit ? accent : colors.border,
                      backgroundColor: digit ? accent + "10" : colors.card,
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: fs(22),
                      borderRadius: colors.radius,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Renvoyer */}
            <View style={styles.resendRow}>
              {resendTimer > 0 ? (
                <Text
                  style={[
                    styles.resendTimer,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {language === "ar"
                    ? `إعادة الإرسال في ${resendTimer}s`
                    : language === "en"
                      ? `Resend in ${resendTimer}s`
                      : `Renvoyer dans ${resendTimer}s`}
                </Text>
              ) : (
                <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                  <Text
                    style={[
                      styles.resendBtn,
                      { color: accent, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {language === "ar"
                      ? "إعادة الإرسال"
                      : language === "en"
                        ? "Resend code"
                        : "Renvoyer le code"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={handleVerifyOTP}
              activeOpacity={0.88}
              disabled={loading || otp.join("").length < 6}
              style={{ width: "100%", marginTop: sp(8) }}
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.ctaBtn,
                  {
                    borderRadius: colors.radius,
                    opacity: otp.join("").length < 6 ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.ctaText, { fontFamily: "Inter_600SemiBold" }]}
                >
                  {loading
                    ? t("common.loading")
                    : language === "ar"
                      ? "تحقق"
                      : language === "en"
                        ? "Verify"
                        : "Vérifier"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Étape Nouveau mot de passe ── */}
        {step === "newPassword" && (
          <>
            <Input
              label={
                language === "ar"
                  ? "كلمة المرور الجديدة"
                  : language === "en"
                    ? "New password"
                    : "Nouveau mot de passe"
              }
              placeholder="••••••••"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPw}
              leftIcon="lock"
              rightIcon={showPw ? "eye-off" : "eye"}
              onRightIconPress={() => setShowPw((v) => !v)}
              autoFocus
            />
            <Input
              label={
                language === "ar"
                  ? "تأكيد كلمة المرور"
                  : language === "en"
                    ? "Confirm password"
                    : "Confirmer le mot de passe"
              }
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPw}
              leftIcon="lock"
              rightIcon={showConfirmPw ? "eye-off" : "eye"}
              onRightIconPress={() => setShowConfirmPw((v) => !v)}
            />
            <TouchableOpacity
              onPress={handleUpdatePassword}
              activeOpacity={0.88}
              disabled={loading || !newPassword || !confirmPassword}
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.ctaBtn,
                  {
                    borderRadius: colors.radius,
                    opacity: !newPassword || !confirmPassword ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.ctaText, { fontFamily: "Inter_600SemiBold" }]}
                >
                  {loading
                    ? t("common.loading")
                    : language === "ar"
                      ? "تغيير كلمة المرور"
                      : language === "en"
                        ? "Update password"
                        : "Mettre à jour"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* ── Étape Succès ── */}
        {step === "success" && (
          <View style={styles.successActions}>
            <TouchableOpacity
              onPress={() => router.replace("/auth/login")}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ctaBtn, { borderRadius: colors.radius }]}
              >
                <Text
                  style={[styles.ctaText, { fontFamily: "Inter_600SemiBold" }]}
                >
                  {language === "ar"
                    ? "تسجيل الدخول"
                    : language === "en"
                      ? "Sign in"
                      : "Se connecter"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: sp(24) },
  backBtn: { marginBottom: sp(20) },
  center: { alignItems: "center", gap: sp(12), marginBottom: sp(32) },
  title: { fontSize: fs(22) },
  sub: { fontSize: fs(14), textAlign: "center", lineHeight: 20 },
  ctaBtn: { paddingVertical: sp(16), alignItems: "center", marginTop: sp(8) },
  ctaText: { color: "#fff", fontSize: fs(16) },
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  successActions: { width: "100%", gap: sp(12) },
  // OTP
  otpContainer: { alignItems: "center", gap: sp(20), width: "100%" },
  otpRow: { flexDirection: "row", gap: sp(10), justifyContent: "center" },
  otpBox: { width: 46, height: 54, borderWidth: 2, textAlign: "center" },
  resendRow: { alignItems: "center" },
  resendTimer: { fontSize: fs(13) },
  resendBtn: { fontSize: fs(14), textDecorationLine: "underline" },
});
