import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Linking,
  TextInput,
} from "react-native";
import { fs, iconSize, sp } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PLANS = [
  {
    key: "starter_monthly",
    price: "99 DH",
    period: { fr: "/ mois", ar: "/ شهر", en: "/ month" },
    label: { fr: "Pro", ar: "برو", en: "Pro" },
    description: {
      fr: "1 magasin, toutes les fonctionnalités",
      ar: "متجر واحد، جميع الميزات",
      en: "1 store, all features",
    },
    color: "#2C3E8C",
    months: 1,
    plan: "starter",
  },
  {
    key: "starter_annual",
    price: "990 DH",
    period: { fr: "/ an", ar: "/ سنة", en: "/ year" },
    label: { fr: "Pro Annuel", ar: "برو سنوي", en: "Pro Annual" },
    description: {
      fr: "Économisez 198 DH — 2 mois offerts",
      ar: "وفر 198 درهم — شهران مجانيان",
      en: "Save 198 DH — 2 months free",
    },
    color: "#27AE60",
    months: 12,
    plan: "starter",
    badge: { fr: "Meilleur prix", ar: "أفضل سعر", en: "Best value" },
  },
  {
    key: "pro_monthly",
    price: "199 DH",
    period: { fr: "/ mois", ar: "/ شهر", en: "/ month" },
    label: { fr: "Pro+", ar: " +برو", en: "Pro+" },
    description: {
      fr: "Plusieurs magasins, analytics avancés",
      ar: "عدة متاجر، تحليلات متقدمة",
      en: "Multiple stores, advanced analytics",
    },
    color: "#9B59B6",
    months: 1,
    plan: "pro",
  },
];

const WHATSAPP_NUMBER = "+33652838081"; // ← Remplace par ton numéro HiomAI

export default function SubscriptionExpiredScreen() {
  const colors = useColors();
  const { user, language } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showActivation, setShowActivation] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(merchant)/home");
    }
  }
  const labelTitle =
    language === "ar"
      ? "انتهت صلاحية اشتراكك"
      : language === "en"
        ? "Your subscription has expired"
        : "Votre abonnement a expiré";
  const labelSub =
    language === "ar"
      ? "اختر خطة للاستمرار في استخدام Fideliio"
      : language === "en"
        ? "Choose a plan to continue using Fideliio"
        : "Choisissez un plan pour continuer à utiliser Fideliio";
  const labelContact =
    language === "ar"
      ? "تواصل معنا عبر واتساب للاشتراك"
      : language === "en"
        ? "Contact us on WhatsApp to subscribe"
        : "Contactez-nous sur WhatsApp pour vous abonner";
  const labelHaveCode =
    language === "ar"
      ? "لدي رمز تفعيل"
      : language === "en"
        ? "I have an activation code"
        : "J'ai un code d'activation";
  const labelActivate =
    language === "ar" ? "تفعيل" : language === "en" ? "Activate" : "Activer";
  const labelCodePlaceholder =
    language === "ar" ? "XXXX-XXXX-XXXX" : "XXXX-XXXX-XXXX";
  const labelBack =
    language === "ar" ? "العودة" : language === "en" ? "Go back" : "Retour";

  async function handleContactWhatsApp(planKey: string) {
    setSelectedPlan(planKey);
    const plan = PLANS.find((p) => p.key === planKey);
    if (!plan) return;

    const planLabel =
      plan.label[language as keyof typeof plan.label] ?? plan.label.fr;
    const message =
      language === "ar"
        ? `مرحباً، أريد الاشتراك في Fideliio - خطة ${planLabel} (${plan.price})`
        : language === "en"
          ? `Hello, I'd like to subscribe to Fideliio - ${planLabel} plan (${plan.price})`
          : `Bonjour, je souhaite m'abonner à Fideliio - Plan ${planLabel} (${plan.price})`;

    const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/\+/g, "")}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp.");
    }
  }

  async function handleActivate() {
    if (!activationCode.trim()) return;
    setActivating(true);
    try {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!merchant) throw new Error("Commerce introuvable");

      const { data: result } = await supabase.rpc("activate_subscription", {
        p_merchant_id: merchant.id,
        p_code: activationCode.trim().toUpperCase(),
        p_plan: "starter",
        p_months: 1,
      });

      if (!result?.success) {
        Alert.alert(
          language === "ar" ? "رمز خاطئ" : "Code invalide",
          language === "ar"
            ? "الرمز غير صحيح أو منتهي الصلاحية"
            : language === "en"
              ? "Invalid or expired code"
              : "Code incorrect ou expiré",
        );
        return;
      }

      // ✅ Succès — accès merchant
      Alert.alert(
        "✓",
        language === "ar"
          ? "تم تفعيل اشتراكك بنجاح!"
          : language === "en"
            ? "Subscription activated!"
            : "Abonnement activé !",
        [
          {
            text: "OK",
            onPress: async () => {
              await AsyncStorage.setItem("@active_role", "merchant");
              router.replace("/(merchant)/home");
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Activation échouée.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerWrap}>
          <View style={[styles.expiredIcon, { backgroundColor: "#E74C3C15" }]}>
            <Feather name="clock" size={iconSize(40)} color="#E74C3C" />
          </View>
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

        {/* ── Plans ── */}
        {PLANS.map((plan) => {
          const label =
            plan.label[language as keyof typeof plan.label] ?? plan.label.fr;
          const desc =
            plan.description[language as keyof typeof plan.description] ??
            plan.description.fr;
          const period =
            plan.period[language as keyof typeof plan.period] ?? plan.period.fr;
          const badge = plan.badge?.[language as keyof typeof plan.badge];

          return (
            <TouchableOpacity
              key={plan.key}
              onPress={() => handleContactWhatsApp(plan.key)}
              activeOpacity={0.88}
              style={[
                styles.planCard,
                {
                  borderColor: plan.color + "40",
                  backgroundColor: plan.color + "08",
                },
              ]}
            >
              {badge && (
                <View
                  style={[styles.planBadge, { backgroundColor: plan.color }]}
                >
                  <Text
                    style={[
                      styles.planBadgeText,
                      { fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {badge}
                  </Text>
                </View>
              )}
              <View style={styles.planRow}>
                <View
                  style={[
                    styles.planIconWrap,
                    { backgroundColor: plan.color + "20" },
                  ]}
                >
                  <Feather
                    name="briefcase"
                    size={iconSize(22)}
                    color={plan.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.planLabel,
                      { color: plan.color, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.planDesc,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {desc}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.planPrice,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {plan.price}
                  </Text>
                  <Text
                    style={[
                      styles.planPeriod,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {period}
                  </Text>
                </View>
              </View>
              <View
                style={[styles.whatsappBtn, { backgroundColor: plan.color }]}
              >
                <Feather
                  name="message-circle"
                  size={iconSize(16)}
                  color="#fff"
                />
                <Text
                  style={[
                    styles.whatsappText,
                    { fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {language === "ar"
                    ? "تواصل عبر واتساب"
                    : language === "en"
                      ? "Contact via WhatsApp"
                      : "Contacter via WhatsApp"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Code d'activation ── */}
        <TouchableOpacity
          onPress={() => setShowActivation(!showActivation)}
          style={styles.codeToggle}
        >
          <Feather
            name={showActivation ? "chevron-up" : "chevron-down"}
            size={iconSize(16)}
            color={colors.mutedForeground}
          />
          <Text
            style={[
              styles.codeToggleText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {labelHaveCode}
          </Text>
        </TouchableOpacity>

        {showActivation && (
          <View
            style={[
              styles.activationBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.activationLabel,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {language === "ar"
                ? "أدخل رمز التفعيل"
                : language === "en"
                  ? "Enter your activation code"
                  : "Entrez votre code d'activation"}
            </Text>
            <TextInput
              value={activationCode}
              onChangeText={(text) => setActivationCode(text.toUpperCase())}
              placeholder={labelCodePlaceholder}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              style={[
                styles.codeInput,
                {
                  color: colors.foreground,
                  borderColor: activationCode ? "#2C3E8C" : colors.border,
                  backgroundColor: colors.background,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleActivate}
              disabled={activating || !activationCode.trim()}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={["#1a237e", "#0288d1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.activateBtn,
                  { opacity: !activationCode.trim() || activating ? 0.5 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.activateBtnText,
                    { fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {activating
                    ? language === "en"
                      ? "Activating..."
                      : "Activation..."
                    : labelActivate}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Retour ── */}
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Feather
            name="arrow-left"
            size={iconSize(16)}
            color={colors.mutedForeground}
          />
          <Text
            style={[
              styles.backText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {labelBack}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  // Header
  headerWrap: { alignItems: "center", gap: sp(12), marginBottom: sp(28) },
  expiredIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: fs(22), textAlign: "center" },
  sub: { fontSize: fs(14), textAlign: "center", lineHeight: 21 },
  // Plans
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: sp(12),
    gap: sp(12),
    overflow: "hidden",
  },
  planBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  planBadgeText: { color: "#fff", fontSize: fs(11) },
  planRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  planLabel: { fontSize: fs(16) },
  planDesc: { fontSize: fs(12), marginTop: 2 },
  planPrice: { fontSize: fs(18) },
  planPeriod: { fontSize: fs(12) },
  whatsappBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  whatsappText: { color: "#fff", fontSize: fs(14) },
  // Activation
  codeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: sp(16),
  },
  codeToggleText: { fontSize: fs(14) },
  activationBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: sp(14),
    marginBottom: sp(8),
  },
  activationLabel: { fontSize: fs(15) },
  codeInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: fs(18),
    letterSpacing: 3,
    textAlign: "center",
  },
  activateBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  activateBtnText: { color: "#fff", fontSize: fs(16) },
  // Back
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: sp(16),
  },
  backText: { fontSize: fs(14) },
});
