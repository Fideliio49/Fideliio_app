import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { fs, iconSize, sp } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

const CATEGORY_KEYS = [
  {
    key: "restaurant",
    icon: "coffee",
    label: { fr: "Restaurant", ar: "مطعم", en: "Restaurant" },
  },
  {
    key: "clothing",
    icon: "shopping-bag",
    label: { fr: "Vêtements", ar: "ملابس", en: "Clothing" },
  },
  {
    key: "hairSalon",
    icon: "scissors",
    label: { fr: "Salon", ar: "صالون", en: "Hair Salon" },
  },
  {
    key: "hotel",
    icon: "home",
    label: { fr: "Hôtel", ar: "فندق", en: "Hotel" },
  },
  {
    key: "other",
    icon: "star",
    label: { fr: "Autre", ar: "أخرى", en: "Other" },
  },
] as const;

const PRO_PLUS_STORES = [
  { stores: 2, monthly: 149, annual: 1490 },
  { stores: 3, monthly: 198, annual: 1980 },
  { stores: 4, monthly: 297, annual: 2970 },
  { stores: 5, monthly: 395, annual: 3950 },
];

type PlanKey = "free" | "pro" | "pro_plus";
type Step = "form" | "plan" | "pro_plus_stores" | "success";

export default function MerchantSetupScreen() {
  const colors = useColors();
  const { user, language } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [bizName, setBizName] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [trialExpiry, setTrialExpiry] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [selectedStores, setSelectedStores] = useState<number>(2);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const l = (fr: string, en: string, ar: string) =>
    language === "ar" ? ar : language === "en" ? en : fr;

  function handleFormNext() {
    if (!bizName.trim()) {
      Alert.alert(
        l("Requis", "Required", "مطلوب"),
        l(
          "Veuillez entrer le nom de votre commerce",
          "Please enter your business name",
          "يرجى إدخال اسم المتجر",
        ),
      );
      return;
    }
    if (!category) {
      Alert.alert(
        l("Requis", "Required", "مطلوب"),
        l(
          "Veuillez choisir une catégorie",
          "Please select a category",
          "يرجى اختيار فئة النشاط",
        ),
      );
      return;
    }
    setStep("plan");
  }

  function handlePlanSelect(plan: PlanKey) {
    setSelectedPlan(plan);
    if (plan === "pro_plus") {
      setStep("pro_plus_stores");
    } else {
      handleSetup(plan, 1);
    }
  }

  function handleProPlusConfirm() {
    handleSetup("pro_plus", selectedStores);
  }

  async function handleSetup(plan: PlanKey, maxStores: number) {
    setLoading(true);
    try {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: merchant, error: merchantError } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (merchantError || !merchant) throw new Error("Merchant not found");

      await supabase
        .from("merchants")
        .update({
          business_name: bizName.trim(),
          category,
          subscription_started: true,
          plan: plan,
          max_stores: maxStores,
        })
        .eq("id", merchant.id);

      if (plan === "free") {
        await supabase.from("subscriptions").upsert(
          {
            merchant_id: merchant.id,
            plan: "free",
            status: "active",
            started_at: new Date().toISOString(),
            expires_at: new Date("2099-01-01").toISOString(),
            customer_limit: 10,
            max_stores: 1,
          },
          { onConflict: "merchant_id" },
        );
      } else {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        await supabase.from("subscriptions").upsert(
          {
            merchant_id: merchant.id,
            plan: plan,
            status: "trial",
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            customer_limit: null,
            max_stores: maxStores,
          },
          { onConflict: "merchant_id" },
        );
        setTrialExpiry(
          expiresAt.toLocaleDateString(
            language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR",
            { day: "numeric", month: "long", year: "numeric" },
          ),
        );
      }

      setStep("success");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Une erreur s'est produite.");
    } finally {
      setLoading(false);
    }
  }

  // ── SUCCÈS ──────────────────────────────────────────
  if (step === "success") {
    const isFree = selectedPlan === "free";
    const isProPlus = selectedPlan === "pro_plus";
    const proPlusPrice = PRO_PLUS_STORES.find(
      (p) => p.stores === selectedStores,
    );

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={[
            styles.successWrap,
            { paddingTop: topPad + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.successIcon,
              { backgroundColor: isFree ? "#F9A60215" : "#27AE6015" },
            ]}
          >
            <Feather
              name={isFree ? "zap" : "check-circle"}
              size={iconSize(64)}
              color={isFree ? "#F9A602" : "#27AE60"}
            />
          </View>
          <Text
            style={[
              styles.successTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {l(
              "Votre commerce est configuré !",
              "Your store is ready!",
              "تم إعداد متجرك!",
            )}
          </Text>

          {!isFree && (
            <View
              style={[
                styles.trialBadge,
                { backgroundColor: "#2C3E8C12", borderColor: "#2C3E8C30" },
              ]}
            >
              <Feather name="gift" size={iconSize(20)} color="#2C3E8C" />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.trialBadgeTitle,
                    { color: "#2C3E8C", fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {l("1 mois gratuit 🎉", "1 month free 🎉", "شهر مجاني 🎉")}
                </Text>
                <Text
                  style={[
                    styles.trialBadgeSub,
                    { color: "#2C3E8C", fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {l(
                    `Expire le ${trialExpiry}`,
                    `Expires on ${trialExpiry}`,
                    `ينتهي في ${trialExpiry}`,
                  )}
                </Text>
              </View>
            </View>
          )}

          {isFree && (
            <View
              style={[
                styles.trialBadge,
                { backgroundColor: "#F9A60212", borderColor: "#F9A60230" },
              ]}
            >
              <Feather name="users" size={iconSize(20)} color="#F9A602" />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.trialBadgeTitle,
                    { color: "#F9A602", fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {l(
                    "Plan Gratuit — 10 clients max",
                    "Free Plan — 10 customers max",
                    "الخطة المجانية — 10 عملاء",
                  )}
                </Text>
                <Text
                  style={[
                    styles.trialBadgeSub,
                    { color: "#F9A602", fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {l(
                    "Passez à Pro pour débloquer plus de clients",
                    "Upgrade to Pro to unlock more",
                    "قم بالترقية لفتح المزيد",
                  )}
                </Text>
              </View>
            </View>
          )}

          <View
            style={[
              styles.includedBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.includedTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {l(
                "Inclus dans votre plan :",
                "Included in your plan:",
                "مضمّن في خطتك :",
              )}
            </Text>
            {[
              isFree
                ? l(
                    "10 clients maximum",
                    "10 customers max",
                    "10 عملاء كحد أقصى",
                  )
                : l(
                    "Clients illimités pendant l'essai",
                    "Unlimited customers during trial",
                    "عملاء غير محدودين",
                  ),
              isProPlus
                ? l(
                    `Jusqu'à ${selectedStores} commerces actifs`,
                    `Up to ${selectedStores} active stores`,
                    `حتى ${selectedStores} متاجر`,
                  )
                : l("1 commerce actif", "1 active store", "متجر واحد نشط"),
              l("Scan QR code clients", "QR code scanning", "مسح رمز QR"),
              l(
                "Gestion des récompenses",
                "Rewards management",
                "إدارة المكافآت",
              ),
              l(
                "Promotions & campagnes",
                "Promotions & campaigns",
                "العروض والحملات",
              ),
            ].map((item, i) => (
              <View key={i} style={styles.includedRow}>
                <Feather name="check" size={iconSize(14)} color="#27AE60" />
                <Text
                  style={[
                    styles.includedText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>

          {!isFree && (
            <View
              style={[
                styles.noteBox,
                { backgroundColor: "#F9A60210", borderColor: "#F9A60230" },
              ]}
            >
              <Feather name="info" size={iconSize(14)} color="#F9A602" />
              <Text
                style={[
                  styles.noteText,
                  { color: "#F9A602", fontFamily: "Inter_400Regular" },
                ]}
              >
                {isProPlus
                  ? l(
                      `Après l'essai : ${proPlusPrice?.monthly} DH/mois ou ${proPlusPrice?.annual} DH/an (2 mois offerts)`,
                      `After trial: ${proPlusPrice?.monthly} DH/month or ${proPlusPrice?.annual} DH/year`,
                      `بعد التجربة: ${proPlusPrice?.monthly} درهم/شهر`,
                    )
                  : l(
                      "Après votre essai : 99 DH/mois ou 990 DH/an (2 mois offerts)",
                      "After your trial: 99 DH/month or 990 DH/year (2 months free)",
                      "بعد التجربة: 99 درهم/شهر",
                    )}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => router.replace("/(merchant)/home")}
            activeOpacity={0.88}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={["#1a237e", "#0288d1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.cta, { borderRadius: colors.radius }]}
            >
              <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
                {l("Commencer maintenant", "Get started", "ابدأ الآن")}
              </Text>
              <Feather name="arrow-right" size={iconSize(18)} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PRO+ STORES ─────────────────────────────────────
  if (step === "pro_plus_stores") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => setStep("plan")}
            style={{ marginBottom: sp(16) }}
          >
            <Feather
              name="arrow-left"
              size={iconSize(24)}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.formTitle,
              {
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                marginBottom: sp(8),
              },
            ]}
          >
            {l("Plan Pro+", "Pro+ Plan", "خطة Pro+")}
          </Text>
          <Text
            style={[
              styles.formSub,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                marginBottom: sp(24),
              },
            ]}
          >
            {l(
              "Combien de commerces souhaitez-vous gérer ?",
              "How many stores do you want to manage?",
              "كم عدد المتاجر؟",
            )}
          </Text>

          <View
            style={[styles.billingToggle, { backgroundColor: colors.muted }]}
          >
            {(["monthly", "annual"] as const).map((cycle) => (
              <TouchableOpacity
                key={cycle}
                onPress={() => setBillingCycle(cycle)}
                style={[
                  styles.billingBtn,
                  {
                    backgroundColor:
                      billingCycle === cycle ? colors.card : "transparent",
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Text
                  style={[
                    {
                      fontSize: fs(13),
                      color:
                        billingCycle === cycle
                          ? "#1a237e"
                          : colors.mutedForeground,
                      fontFamily:
                        billingCycle === cycle
                          ? "Inter_700Bold"
                          : "Inter_400Regular",
                    },
                  ]}
                >
                  {cycle === "monthly"
                    ? l("Mensuel", "Monthly", "شهري")
                    : l("Annuel (-17%)", "Annual (-17%)", "سنوي (-17%)")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ gap: sp(12), marginTop: sp(16) }}>
            {PRO_PLUS_STORES.map((option) => {
              const isSelected = selectedStores === option.stores;
              const price =
                billingCycle === "annual" ? option.annual : option.monthly;
              const period =
                billingCycle === "annual"
                  ? l("/an", "/year", "/سنة")
                  : l("/mois", "/month", "/شهر");
              return (
                <TouchableOpacity
                  key={option.stores}
                  onPress={() => setSelectedStores(option.stores)}
                  activeOpacity={0.85}
                  style={[
                    styles.storeOption,
                    {
                      borderColor: isSelected ? "#9B59B6" : colors.border,
                      backgroundColor: isSelected ? "#9B59B608" : colors.card,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.storeIconWrap,
                      {
                        backgroundColor: isSelected
                          ? "#9B59B620"
                          : colors.muted,
                      },
                    ]}
                  >
                    <Feather
                      name="briefcase"
                      size={iconSize(20)}
                      color={isSelected ? "#9B59B6" : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        {
                          color: isSelected ? "#9B59B6" : colors.foreground,
                          fontFamily: "Inter_700Bold",
                          fontSize: fs(15),
                        },
                      ]}
                    >
                      {option.stores} {l("commerces", "stores", "متاجر")}
                    </Text>
                    <Text
                      style={[
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: fs(12),
                          marginTop: 2,
                        },
                      ]}
                    >
                      {l(
                        "1 mois gratuit inclus",
                        "1 month free included",
                        "شهر مجاني",
                      )}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        {
                          color: isSelected ? "#9B59B6" : colors.foreground,
                          fontFamily: "Inter_700Bold",
                          fontSize: fs(18),
                        },
                      ]}
                    >
                      {price} DH
                    </Text>
                    <Text
                      style={[
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: fs(12),
                        },
                      ]}
                    >
                      {period}
                    </Text>
                  </View>
                  {isSelected && (
                    <Feather
                      name="check-circle"
                      size={iconSize(20)}
                      color="#9B59B6"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleProPlusConfirm}
            disabled={loading}
            activeOpacity={0.88}
            style={[styles.ctaWrap, { marginTop: sp(24) }]}
          >
            <LinearGradient
              colors={["#9B59B6", "#8E44AD"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.cta, { borderRadius: colors.radius }]}
            >
              <Feather name="gift" size={iconSize(18)} color="#fff" />
              <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
                {loading
                  ? l("Configuration...", "Setting up...", "جارٍ الإعداد...")
                  : l(
                      "Démarrer l'essai gratuit",
                      "Start free trial",
                      "ابدأ التجربة المجانية",
                    )}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── SÉLECTION DU PLAN ───────────────────────────────
  if (step === "plan") {
    const PLANS = [
      {
        key: "free" as PlanKey,
        icon: "zap",
        color: "#F9A602",
        title: l("Gratuit", "Free", "مجاني"),
        price: "0 DH",
        period: "",
        desc: l(
          "Pour démarrer simplement",
          "To get started simply",
          "للبدء ببساطة",
        ),
        features: [
          l("10 clients maximum", "10 customers max", "10 عملاء كحد أقصى"),
          l("1 commerce", "1 store", "متجر واحد"),
          l("Toutes les fonctionnalités", "All features", "جميع الميزات"),
        ],
        trial: false,
        badge: null,
        ctaLabel: l("Commencer gratuitement", "Start for free", "ابدأ مجاناً"),
      },
      {
        key: "pro" as PlanKey,
        icon: "briefcase",
        color: "#2C3E8C",
        title: "Pro",
        price: "99 DH",
        period: l("/mois", "/month", "/شهر"),
        desc: l(
          "Pour un commerce actif",
          "For one active store",
          "لمتجر واحد نشط",
        ),
        features: [
          l("Clients illimités", "Unlimited customers", "عملاء غير محدودين"),
          l("1 commerce actif", "1 active store", "متجر واحد نشط"),
          l(
            "Session unique (1 appareil)",
            "Single session (1 device)",
            "جهاز واحد فقط",
          ),
          l("1 mois gratuit", "1 month free", "شهر مجاني"),
        ],
        trial: true,
        badge: l("Le plus populaire", "Most popular", "الأكثر شيوعاً"),
        ctaLabel: l(
          "Démarrer l'essai gratuit",
          "Start free trial",
          "ابدأ التجربة المجانية",
        ),
      },
      {
        key: "pro_plus" as PlanKey,
        icon: "layers",
        color: "#9B59B6",
        title: "Pro+",
        price: l("Dès 149 DH", "From 149 DH", "من 149 درهم"),
        period: l("/mois", "/month", "/شهر"),
        desc: l(
          "Pour plusieurs commerces",
          "For multiple stores",
          "لعدة متاجر",
        ),
        features: [
          l("Clients illimités", "Unlimited customers", "عملاء غير محدودين"),
          l("2 à 5 commerces actifs", "2 to 5 active stores", "2 إلى 5 متاجر"),
          l("Multi-appareils", "Multi-device", "متعدد الأجهزة"),
          l("1 mois gratuit", "1 month free", "شهر مجاني"),
        ],
        trial: true,
        badge: null,
        ctaLabel: l("Choisir Pro+ →", "Choose Pro+ →", "اختر Pro+ ←"),
      },
    ];

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => setStep("form")}
            style={{ marginBottom: sp(16) }}
          >
            <Feather
              name="arrow-left"
              size={iconSize(24)}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.formTitle,
              {
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                marginBottom: sp(4),
              },
            ]}
          >
            {l("Choisissez votre plan", "Choose your plan", "اختر خطتك")}
          </Text>
          <Text
            style={[
              styles.formSub,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                marginBottom: sp(24),
              },
            ]}
          >
            {l(
              "Commencez gratuitement, évoluez selon vos besoins",
              "Start free, scale as you grow",
              "ابدأ مجاناً وتطور حسب احتياجاتك",
            )}
          </Text>

          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.key}
              onPress={() => handlePlanSelect(plan.key)}
              activeOpacity={0.88}
              style={[
                styles.planCard,
                {
                  borderColor: plan.color + "40",
                  backgroundColor: plan.color + "06",
                },
              ]}
            >
              {plan.badge && (
                <View
                  style={[styles.planBadge, { backgroundColor: plan.color }]}
                >
                  <Text
                    style={[
                      {
                        color: "#fff",
                        fontSize: fs(10),
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {plan.badge}
                  </Text>
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: sp(12),
                }}
              >
                <View
                  style={[
                    styles.planIconWrap,
                    { backgroundColor: plan.color + "20" },
                  ]}
                >
                  <Feather
                    name={plan.icon as any}
                    size={iconSize(22)}
                    color={plan.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      {
                        color: plan.color,
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(18),
                      },
                    ]}
                  >
                    {plan.title}
                  </Text>
                  <Text
                    style={[
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(12),
                      },
                    ]}
                  >
                    {plan.desc}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(18),
                      },
                    ]}
                  >
                    {plan.price}
                  </Text>
                  {plan.period ? (
                    <Text
                      style={[
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: fs(12),
                        },
                      ]}
                    >
                      {plan.period}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ gap: sp(6) }}>
                {plan.features.map((feat, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Feather
                      name="check"
                      size={iconSize(13)}
                      color={plan.color}
                    />
                    <Text
                      style={[
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          fontSize: fs(13),
                        },
                      ]}
                    >
                      {feat}
                    </Text>
                  </View>
                ))}
              </View>
              {plan.trial && (
                <View
                  style={[
                    styles.trialChip,
                    { backgroundColor: "#27AE6015", borderColor: "#27AE6030" },
                  ]}
                >
                  <Feather name="gift" size={iconSize(12)} color="#27AE60" />
                  <Text
                    style={[
                      {
                        color: "#27AE60",
                        fontFamily: "Inter_600SemiBold",
                        fontSize: fs(12),
                      },
                    ]}
                  >
                    {l(
                      "1 mois gratuit inclus",
                      "1 month free included",
                      "شهر مجاني مشمول",
                    )}
                  </Text>
                </View>
              )}
              <View style={[styles.planCta, { backgroundColor: plan.color }]}>
                <Text
                  style={[
                    {
                      color: "#fff",
                      fontFamily: "Inter_700Bold",
                      fontSize: fs(14),
                    },
                  ]}
                >
                  {plan.ctaLabel}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── FORMULAIRE ──────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={["#1a237e", "#0288d1"]}
            style={styles.headerIcon}
          >
            <Feather name="briefcase" size={iconSize(28)} color="#fff" />
          </LinearGradient>
          <Text
            style={[
              styles.formTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {l(
              "Bienvenue sur Fideliio",
              "Welcome to Fideliio",
              "أهلاً بك في Fideliio",
            )}
          </Text>
          <Text
            style={[
              styles.formSub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {l(
              "Dites-nous en plus sur votre commerce",
              "Tell us about your business",
              "أخبرنا عن متجرك",
            )}
          </Text>
        </View>

        <Input
          label={l("Nom du commerce", "Business name", "اسم المتجر")}
          placeholder={l(
            "ex: Boulangerie du Soleil",
            "e.g. Sunrise Coffee",
            "مثال: مقهى الشروق",
          )}
          value={bizName}
          onChangeText={setBizName}
          leftIcon="briefcase"
          autoFocus
        />

        <Text
          style={[
            styles.catLabel,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {l("Catégorie", "Category", "الفئة")}
        </Text>
        <View style={styles.catGrid}>
          {CATEGORY_KEYS.map((cat) => {
            const isSelected = category === cat.key;
            const label =
              cat.label[language as keyof typeof cat.label] ?? cat.label.fr;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={[
                  styles.catChip,
                  {
                    borderColor: isSelected ? "#1a237e" : colors.border,
                    backgroundColor: isSelected ? "#1a237e12" : colors.card,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Feather
                  name={cat.icon as any}
                  size={iconSize(18)}
                  color={isSelected ? "#1a237e" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color: isSelected ? "#1a237e" : colors.mutedForeground,
                      fontFamily: isSelected
                        ? "Inter_600SemiBold"
                        : "Inter_400Regular",
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={handleFormNext}
          activeOpacity={0.88}
          disabled={!bizName.trim() || !category}
          style={[styles.ctaWrap, { marginTop: sp(24) }]}
        >
          <LinearGradient
            colors={["#1a237e", "#0288d1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.cta,
              {
                borderRadius: colors.radius,
                opacity: !bizName.trim() || !category ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
              {l("Continuer", "Continue", "متابعة")}
            </Text>
            <Feather name="arrow-right" size={iconSize(18)} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  header: { alignItems: "center", gap: sp(12), marginBottom: sp(24) },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: { fontSize: fs(24), textAlign: "center" },
  formSub: {
    fontSize: fs(14),
    textAlign: "center",
    lineHeight: 21,
    color: "#6B7280",
  },
  catLabel: { fontSize: fs(14), marginBottom: sp(10), marginTop: sp(4) },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  catChipText: { fontSize: fs(13) },
  ctaWrap: { width: "100%" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: sp(16),
  },
  ctaText: { color: "#fff", fontSize: fs(16) },
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
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trialChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  planCta: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: sp(4),
  },
  billingToggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    marginBottom: sp(8),
  },
  billingBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  storeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  successWrap: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: sp(20),
    paddingBottom: 60,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: fs(24), textAlign: "center" },
  trialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    width: "100%",
  },
  trialBadgeTitle: { fontSize: fs(16) },
  trialBadgeSub: { fontSize: fs(13), marginTop: 2 },
  includedBox: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: sp(10),
  },
  includedTitle: { fontSize: fs(14), marginBottom: 4 },
  includedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  includedText: { fontSize: fs(13), flex: 1 },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
  },
  noteText: { flex: 1, fontSize: fs(12), lineHeight: 18 },
});
