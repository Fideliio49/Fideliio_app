import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Keyboard,
} from "react-native";
import { fs, sp, iconSize } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PhoneOTPScreen() {
  const colors = useColors();
  const { completeOnboarding, language } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Labels
  const labelTitle =
    language === "ar"
      ? "تسجيل الدخول"
      : language === "en"
        ? "Sign in"
        : "Connexion";
  const labelPhone =
    language === "ar"
      ? "رقم الهاتف"
      : language === "en"
        ? "Phone number"
        : "Numéro de téléphone";
  const labelPhonePlaceholder =
    language === "ar" ? "+212 6XX XXX XXX" : "+33 6 XX XX XX XX";
  const labelSend =
    language === "ar"
      ? "إرسال الرمز"
      : language === "en"
        ? "Send code"
        : "Envoyer le code";
  const labelOtpTitle =
    language === "ar"
      ? "أدخل الرمز"
      : language === "en"
        ? "Enter the code"
        : "Entrez le code";
  const labelOtpSub =
    language === "ar"
      ? `تم إرسال رمز إلى ${phone}`
      : language === "en"
        ? `Code sent to ${phone}`
        : `Code envoyé au ${phone}`;
  const labelVerify =
    language === "ar" ? "تحقق" : language === "en" ? "Verify" : "Vérifier";
  const labelResend =
    language === "ar"
      ? "إعادة الإرسال"
      : language === "en"
        ? "Resend"
        : "Renvoyer";
  const labelBack =
    language === "ar" ? "رجوع" : language === "en" ? "Back" : "Retour";
  const labelWrongNumber =
    language === "ar"
      ? "رقم خاطئ؟"
      : language === "en"
        ? "Wrong number?"
        : "Mauvais numéro ?";

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

  // ── Formater le numéro en international ──────────────────
  function formatPhone(raw: string): string {
    const cleaned = raw.replace(/\s/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
    // Numéro marocain local → +212
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      return "+212" + cleaned.slice(1);
    }
    // Numéro français local → +33
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      return "+33" + cleaned.slice(1);
    }
    return "+" + cleaned;
  }

  // ── Envoyer le SMS OTP ────────────────────────────────────
  async function handleSendOTP() {
    const formatted = formatPhone(phone);
    if (formatted.length < 8) {
      Alert.alert(
        language === "ar" ? "خطأ" : "Erreur",
        language === "ar"
          ? "أدخل رقم هاتف صحيح"
          : language === "en"
            ? "Enter a valid phone number"
            : "Entrez un numéro valide",
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formatted,
      });
      if (error) throw error;
      setStep("otp");
      startResendTimer();
      // Focus premier champ OTP
      setTimeout(() => otpRefs.current[0]?.focus(), 400);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("rate limit")) {
        Alert.alert(
          "Erreur",
          "Trop de tentatives. Attendez avant de réessayer.",
        );
      } else {
        Alert.alert("Erreur", msg || "Impossible d'envoyer le SMS.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Vérifier l'OTP ────────────────────────────────────────
  async function handleVerifyOTP() {
    const code = otp.join("");
    if (code.length < 6) {
      Alert.alert(
        language === "ar" ? "خطأ" : "Erreur",
        language === "ar"
          ? "أدخل الرمز المكون من 6 أرقام"
          : language === "en"
            ? "Enter the 6-digit code"
            : "Entrez le code à 6 chiffres",
      );
      return;
    }

    setLoading(true);
    try {
      const formatted = formatPhone(phone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formatted,
        token: code,
        type: "sms",
      });
      if (error) throw error;

      await completeOnboarding();
      const storedRole = await AsyncStorage.getItem("@active_role");
      if (storedRole) {
        router.replace(
          storedRole === "merchant" ? "/(merchant)/home" : "/(customer)/home",
        );
      } else {
        router.replace("/auth/role");
      }
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
        // Reset OTP fields
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      } else {
        Alert.alert("Erreur", msg || "Vérification échouée.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Gestion des champs OTP ────────────────────────────────
  function handleOtpChange(value: string, index: number) {
    if (value.length > 1) {
      // Coller un code complet
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

  // ─────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sp(20) },
        ]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => (step === "otp" ? setStep("phone") : router.back())}
          style={styles.backBtn}
        >
          <Feather
            name="arrow-left"
            size={iconSize(22)}
            color={colors.foreground}
          />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <Feather
              name="smartphone"
              size={iconSize(32)}
              color={colors.primary}
            />
          </View>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {step === "phone" ? labelPhone : labelOtpTitle}
          </Text>
          {step === "otp" && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {labelOtpSub}
            </Text>
          )}
        </View>

        {/* ── Étape 1 : Saisie numéro ── */}
        {step === "phone" && (
          <View style={styles.form}>
            <Text
              style={[
                styles.label,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {labelPhone}
            </Text>
            <View
              style={[
                styles.phoneInput,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="phone"
                size={iconSize(18)}
                color={colors.mutedForeground}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={labelPhonePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                autoFocus
                allowFontScaling={false}
                style={[
                  styles.phoneTextInput,
                  {
                    color: colors.foreground,
                    fontFamily: "Inter_400Regular",
                    fontSize: fs(16),
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.hint,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {language === "ar"
                ? "أدخل الرقم بالصيغة الدولية مثل +212XXXXXXXXX"
                : language === "en"
                  ? "Include country code e.g. +33 6XX XX XX XX"
                  : "Incluez l'indicatif pays ex: +33 6XX XX XX XX"}
            </Text>
          </View>
        )}

        {/* ── Étape 2 : Saisie OTP ── */}
        {step === "otp" && (
          <View style={styles.otpContainer}>
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
                  maxLength={6} // permet le paste
                  allowFontScaling={false}
                  selectTextOnFocus
                  style={[
                    styles.otpBox,
                    {
                      borderColor: digit ? colors.primary : colors.border,
                      backgroundColor: digit
                        ? colors.primary + "10"
                        : colors.card,
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: fs(22),
                      borderRadius: colors.radius,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Renvoyer le code */}
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
                      {
                        color: colors.primary,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {labelResend}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mauvais numéro */}
            <TouchableOpacity
              onPress={() => {
                setStep("phone");
                setOtp(["", "", "", "", "", ""]);
              }}
              style={styles.wrongNumber}
            >
              <Text
                style={[
                  styles.wrongNumberText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {labelWrongNumber}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          onPress={step === "phone" ? handleSendOTP : handleVerifyOTP}
          disabled={loading}
          activeOpacity={0.88}
          style={{ marginTop: sp(24) }}
        >
          <LinearGradient
            colors={["#C85A17", "#E67E22"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.ctaBtn,
              { borderRadius: colors.radius, opacity: loading ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
              {loading
                ? language === "ar"
                  ? "جاري التحميل..."
                  : language === "en"
                    ? "Loading..."
                    : "Chargement..."
                : step === "phone"
                  ? labelSend
                  : labelVerify}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: sp(24), flexGrow: 1 },
  backBtn: { marginBottom: sp(24), alignSelf: "flex-start", padding: sp(4) },
  header: { alignItems: "center", gap: sp(12), marginBottom: sp(32) },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: fs(26), textAlign: "center" },
  subtitle: { fontSize: fs(14), textAlign: "center", lineHeight: 22 },
  form: { gap: sp(8) },
  label: { fontSize: fs(13), marginBottom: sp(4) },
  phoneInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    paddingHorizontal: sp(14),
    gap: sp(10),
  },
  phoneTextInput: { flex: 1, paddingVertical: sp(14) },
  hint: { fontSize: fs(12), marginTop: sp(4) },
  otpContainer: { alignItems: "center", gap: sp(20) },
  otpRow: { flexDirection: "row", gap: sp(10), justifyContent: "center" },
  otpBox: {
    width: 46,
    height: 54,
    borderWidth: 2,
    textAlign: "center",
    elevation: 0,
  },
  resendRow: { alignItems: "center" },
  resendTimer: { fontSize: fs(13) },
  resendBtn: { fontSize: fs(14), textDecorationLine: "underline" },
  wrongNumber: { marginTop: sp(4) },
  wrongNumberText: { fontSize: fs(13), textDecorationLine: "underline" },
  ctaBtn: { paddingVertical: sp(16), alignItems: "center" },
  ctaText: { color: "#fff", fontSize: fs(16) },
});
