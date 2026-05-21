import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { fs, iconSize, sp } from "@/utils/responsive";
import { useRouter } from "expo-router";

import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

type PlanKey = "pro" | "pro_plus";
type BillingCycle = "monthly" | "annual";

const PRO_PLUS_STORES = [
  { stores: 2, monthly: 149, annual: 1490 },
  { stores: 3, monthly: 198, annual: 1980 },
  { stores: 4, monthly: 297, annual: 2970 },
  { stores: 5, monthly: 395, annual: 3950 },
];

const PLANS = [
  {
    key: "pro" as PlanKey,
    icon: "briefcase",
    color: "#2C3E8C",
    title: "Pro",
    price: { fr: "99 DH", ar: "99 درهم", en: "99 DH" },
    period: { fr: "/ mois", ar: "/ شهر", en: "/ month" },
    desc: {
      fr: "Pour un commerce actif",
      ar: "لمتجر واحد نشط",
      en: "For one active store",
    },
    features: {
      fr: [
        "Clients illimités",
        "1 commerce actif",
        "Session unique (1 appareil)",
      ],
      ar: ["عملاء غير محدودين", "متجر واحد نشط", "جهاز واحد فقط"],
      en: [
        "Unlimited customers",
        "1 active store",
        "Single session (1 device)",
      ],
    },
    badge: { fr: "Le plus populaire", ar: "الأكثر شيوعاً", en: "Most popular" },
    cta: {
      fr: "Démarrer l'essai gratuit",
      ar: "ابدأ التجربة المجانية",
      en: "Start free trial",
    },
  },
  {
    key: "pro_plus" as PlanKey,
    icon: "layers",
    color: "#9B59B6",
    title: "Pro+",
    price: { fr: "Dès 149 DH", ar: "من 149 درهم", en: "From 149 DH" },
    period: { fr: "/ mois", ar: "/ شهر", en: "/ month" },
    desc: {
      fr: "Pour plusieurs commerces",
      ar: "لعدة متاجر",
      en: "For multiple stores",
    },
    features: {
      fr: ["Clients illimités", "2 à 5 commerces actifs", "Multi-appareils"],
      ar: ["عملاء غير محدودين", "2 إلى 5 متاجر", "متعدد الأجهزة"],
      en: ["Unlimited customers", "2 to 5 active stores", "Multi-device"],
    },
    badge: null,
    cta: { fr: "Choisir Pro+ →", ar: "اختر Pro+ ←", en: "Choose Pro+ →" },
  },
];

export default function SubscriptionExpiredScreen() {
  const colors = useColors();
  const { user, language, onMerchantLogin } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [showActivation, setShowActivation] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [showProPlusModal, setShowProPlusModal] = useState(false);
  const [selectedStores, setSelectedStores] = useState(2);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const lang = (language as "fr" | "ar" | "en") ?? "fr";

  function l(fr: string, en: string, ar: string) {
    if (lang === "ar") return ar;
    if (lang === "en") return en;
    return fr;
  }

  const selectedProPlus =
    PRO_PLUS_STORES.find((p) => p.stores === selectedStores) ??
    PRO_PLUS_STORES[0];
  const proPlusprice =
    billingCycle === "annual"
      ? selectedProPlus.annual
      : selectedProPlus.monthly;
  const proPluspriceSuffix =
    billingCycle === "annual"
      ? l("/ an", "/ year", "/ سنة")
      : l("/ mois", "/ month", "/ شهر");

  async function handleStartTrial(planKey: PlanKey, maxStores = 1) {
    setShowProPlusModal(false);
    setLoadingPlan(planKey);
    try {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!merchant) throw new Error("Commerce introuvable");

      // ✅ Vérifier si une subscription valide existe déjà
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id, plan, status")
        .eq("merchant_id", merchant.id)
        .in("status", ["trial", "active"])
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (existingSub) {
        // ✅ Subscription active trouvée → aller directement sans recréer
        await AsyncStorage.setItem("@active_role", "merchant");
        await onMerchantLogin(user.id);
        router.replace("/(merchant)/home");
        return;
      }

      const { data: result, error } = await supabase.rpc("start_trial", {
        p_merchant_id: merchant.id,
        p_plan: planKey,
        p_max_stores: maxStores,
        p_billing_cycle: billingCycle, // ✅ transmettre le cycle choisi
      });

      if (error) throw error;

      const res = Array.isArray(result) ? result[0] : result;

      if (!res?.success) {
        // ✅ Trial "déjà utilisé" → vérifier si la subscription existe quand même
        const { data: subCheck } = await supabase
          .from("subscriptions")
          .select("id, plan, status")
          .eq("merchant_id", merchant.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subCheck?.status === "trial" || subCheck?.status === "active") {
          // ✅ Subscription existe → y aller directement
          await AsyncStorage.setItem("@active_role", "merchant");
          await onMerchantLogin(user.id);
          router.replace("/(merchant)/home");
          return;
        }

        Alert.alert(
          l(
            "Essai déjà utilisé",
            "Trial already used",
            "تم استخدام الفترة التجريبية",
          ),
          l(
            "Vous avez déjà bénéficié d'un mois gratuit. Entrez un code d'activation pour continuer.",
            "You've already used the free trial. Enter an activation code to continue.",
            "لقد استخدمت الفترة التجريبية. أدخل رمز تفعيل للمتابعة.",
          ),
          [
            { text: l("Annuler", "Cancel", "إلغاء"), style: "cancel" },
            {
              text: l("Code d'activation", "Activation code", "رمز التفعيل"),
              onPress: () => setShowActivation(true),
            },
          ],
        );
        return;
      }

      const expiresAt = res.expires_at
        ? new Date(res.expires_at).toLocaleDateString(
            lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR",
          )
        : "";

      Alert.alert(
        "🎉",
        l(
          `Votre essai gratuit démarre maintenant !\nValable jusqu'au ${expiresAt}.`,
          `Your free trial starts now!\nValid until ${expiresAt}.`,
          `بدأت تجربتك المجانية!\nصالحة حتى ${expiresAt}.`,
        ),
        [
          {
            text: "OK",
            onPress: async () => {
              await AsyncStorage.setItem("@active_role", "merchant");
              // ✅ onMerchantLogin enregistre la session device
              await onMerchantLogin(user.id);
              router.replace("/(merchant)/home");
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de démarrer l'essai.");
    } finally {
      setLoadingPlan(null);
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
        p_plan: "pro",
        p_months: 1,
      });

      if (!result?.success) {
        Alert.alert(
          l("Code invalide", "Invalid code", "رمز خاطئ"),
          l(
            "Code incorrect ou expiré.",
            "Invalid or expired code.",
            "الرمز غير صحيح أو منتهي الصلاحية.",
          ),
        );
        return;
      }
      Alert.alert(
        "✓",
        l(
          "Abonnement activé !",
          "Subscription activated!",
          "تم تفعيل اشتراكك!",
        ),
        [
          {
            text: "OK",
            onPress: async () => {
              await AsyncStorage.setItem("@active_role", "merchant");
              await onMerchantLogin(user.id);
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: sp(16) }}
        >
          <Feather
            name="arrow-left"
            size={iconSize(24)}
            color={colors.foreground}
          />
        </TouchableOpacity>

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
            {l(
              "Votre abonnement a expiré",
              "Your subscription has expired",
              "انتهت صلاحية اشتراكك",
            )}
          </Text>
          <Text
            style={[
              styles.sub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {l(
              "Commencez avec 1 mois gratuit, sans engagement",
              "Start with 1 free month, no commitment",
              "ابدأ بشهر مجاني بدون التزام",
            )}
          </Text>
        </View>

        {PLANS.map((plan) => {
          const features = plan.features[lang] ?? plan.features.fr;
          const badge = plan.badge?.[lang] ?? plan.badge?.fr;
          const price =
            plan.key === "pro_plus"
              ? `${proPlusprice} DH`
              : (plan.price[lang] ?? plan.price.fr);
          const period =
            plan.key === "pro_plus"
              ? proPluspriceSuffix
              : (plan.period[lang] ?? plan.period.fr);
          const desc = plan.desc[lang] ?? plan.desc.fr;
          const cta = plan.cta[lang] ?? plan.cta.fr;
          const isLoading = loadingPlan === plan.key;

          return (
            <View
              key={plan.key}
              style={[
                styles.planCard,
                {
                  borderColor: plan.color + "40",
                  backgroundColor: plan.color + "06",
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
                    style={{
                      color: plan.color,
                      fontFamily: "Inter_700Bold",
                      fontSize: fs(18),
                    }}
                  >
                    {plan.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      fontSize: fs(12),
                    }}
                  >
                    {desc}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: fs(18),
                    }}
                  >
                    {price}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      fontSize: fs(12),
                    }}
                  >
                    {period}
                  </Text>
                </View>
              </View>
              <View style={{ gap: sp(6), marginBottom: sp(12) }}>
                {features.map((feat, i) => (
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
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(13),
                      }}
                    >
                      {feat}
                    </Text>
                  </View>
                ))}
              </View>
              <View
                style={[
                  styles.trialChip,
                  { backgroundColor: "#27AE6015", borderColor: "#27AE6030" },
                ]}
              >
                <Feather name="gift" size={iconSize(12)} color="#27AE60" />
                <Text
                  style={{
                    color: "#27AE60",
                    fontFamily: "Inter_600SemiBold",
                    fontSize: fs(12),
                  }}
                >
                  {l(
                    "1 mois gratuit inclus",
                    "1 month free included",
                    "شهر مجاني مشمول",
                  )}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (plan.key === "pro_plus") setShowProPlusModal(true);
                  else handleStartTrial("pro", 1);
                }}
                disabled={!!loadingPlan}
                activeOpacity={0.88}
                style={[
                  styles.planCta,
                  {
                    backgroundColor: plan.color,
                    opacity: loadingPlan && !isLoading ? 0.5 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Inter_700Bold",
                      fontSize: fs(14),
                    }}
                  >
                    {cta}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

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
            {l(
              "J'ai un code d'activation",
              "I have an activation code",
              "لدي رمز تفعيل",
            )}
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
              {l(
                "Entrez votre code d'activation",
                "Enter your activation code",
                "أدخل رمز التفعيل",
              )}
            </Text>
            <TextInput
              value={activationCode}
              onChangeText={(text) => setActivationCode(text.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
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
              <View
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
                    ? l("Activation...", "Activating...", "جاري التفعيل...")
                    : l("Activer", "Activate", "تفعيل")}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: sp(32) }} />
      </ScrollView>

      <Modal
        visible={showProPlusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProPlusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalCard, { backgroundColor: colors.background }]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: sp(20),
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: fs(20),
                }}
              >
                Pro+
              </Text>
              <TouchableOpacity onPress={() => setShowProPlusModal(false)}>
                <Feather
                  name="x"
                  size={iconSize(22)}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
            <View
              style={[styles.billingToggle, { backgroundColor: colors.card }]}
            >
              {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
                <TouchableOpacity
                  key={cycle}
                  onPress={() => setBillingCycle(cycle)}
                  style={[
                    styles.billingBtn,
                    billingCycle === cycle && { backgroundColor: "#9B59B6" },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: fs(13),
                      color:
                        billingCycle === cycle
                          ? "#fff"
                          : colors.mutedForeground,
                    }}
                  >
                    {cycle === "monthly"
                      ? l("Mensuel", "Monthly", "شهري")
                      : l("Annuel", "Annual", "سنوي")}
                  </Text>
                  {cycle === "annual" && (
                    <Text
                      style={{
                        color: "#27AE60",
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(10),
                      }}
                    >
                      {l("-2 mois", "-2 months", "-شهران")}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: fs(13),
                marginBottom: sp(10),
              }}
            >
              {l("Nombre de commerces", "Number of stores", "عدد المتاجر")}
            </Text>
            <View style={styles.storesGrid}>
              {PRO_PLUS_STORES.map((opt) => {
                const price =
                  billingCycle === "annual" ? opt.annual : opt.monthly;
                const isSelected = selectedStores === opt.stores;
                return (
                  <TouchableOpacity
                    key={opt.stores}
                    onPress={() => setSelectedStores(opt.stores)}
                    style={[
                      styles.storeOption,
                      {
                        borderColor: isSelected ? "#9B59B6" : colors.border,
                        backgroundColor: isSelected ? "#9B59B608" : colors.card,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#9B59B6" : colors.foreground,
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(20),
                      }}
                    >
                      {opt.stores}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(11),
                      }}
                    >
                      {l("commerces", "stores", "متاجر")}
                    </Text>
                    <Text
                      style={{
                        color: isSelected ? "#9B59B6" : colors.foreground,
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(13),
                      }}
                    >
                      {price} DH
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View
              style={[
                styles.summaryBox,
                { backgroundColor: "#9B59B608", borderColor: "#9B59B630" },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: fs(13),
                  }}
                >
                  {l("Plan sélectionné", "Selected plan", "الخطة المختارة")}
                </Text>
                <Text
                  style={{
                    color: "#9B59B6",
                    fontFamily: "Inter_700Bold",
                    fontSize: fs(13),
                  }}
                >
                  Pro+ · {selectedStores} {l("commerces", "stores", "متاجر")}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: sp(6),
                }}
              >
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: fs(13),
                  }}
                >
                  {l("Prix", "Price", "السعر")}
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_700Bold",
                    fontSize: fs(15),
                  }}
                >
                  {proPlusprice} DH {proPluspriceSuffix}
                </Text>
              </View>
              <View
                style={[
                  styles.trialChip,
                  {
                    backgroundColor: "#27AE6015",
                    borderColor: "#27AE6030",
                    marginTop: sp(10),
                  },
                ]}
              >
                <Feather name="gift" size={iconSize(12)} color="#27AE60" />
                <Text
                  style={{
                    color: "#27AE60",
                    fontFamily: "Inter_600SemiBold",
                    fontSize: fs(12),
                  }}
                >
                  {l(
                    "1 mois gratuit inclus",
                    "1 month free included",
                    "شهر مجاني مشمول",
                  )}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleStartTrial("pro_plus", selectedStores)}
              activeOpacity={0.88}
              style={[
                styles.planCta,
                { backgroundColor: "#9B59B6", marginTop: sp(4) },
              ]}
            >
              {loadingPlan === "pro_plus" ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "Inter_700Bold",
                    fontSize: fs(15),
                  }}
                >
                  {l(
                    "Démarrer l'essai gratuit",
                    "Start free trial",
                    "ابدأ التجربة المجانية",
                  )}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
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
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: sp(16),
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
  planBadgeText: { color: "#fff", fontSize: fs(10) },
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
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: sp(12),
  },
  planCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  billingToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: sp(20),
  },
  billingBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 2,
  },
  storesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: sp(20),
  },
  storeOption: {
    width: "47%",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: sp(16),
  },
});
