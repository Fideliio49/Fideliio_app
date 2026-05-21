import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  Platform,
  Switch,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { fs, iconSize, sp } from "@/utils/responsive";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Language, ACCENT_COLORS } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AvatarPicker } from "@/components/AvatarPicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇲🇦" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const CATEGORY_KEYS = ["restaurant", "clothing", "hairSalon", "hotel", "other"] as const;
const DEFAULT_PRESETS = [10, 25, 50, 100, 200, 500];

type BillingCycle = "monthly" | "annual" | "unknown";

const PRO_PRICE = { monthly: 99, annual: 990 };

const PRO_PLUS_STORES = [
  { stores: 2, monthly: 149, annual: 1490 },
  { stores: 3, monthly: 198, annual: 1980 },
  { stores: 4, monthly: 297, annual: 2970 },
  { stores: 5, monthly: 395, annual: 3950 },
];

const ADMIN_RIB = {
  name: "Fideliio SARL",
  rib: "007 780 0001234567890123 45",
  bank: "CIH Bank",
  whatsapp: "+212600000000",
  whatsappDisplay: "+212 6 00 00 00 00",
};

// ── Helpers ───────────────────────────────────────────────────
function getPlanDisplayLabel(plan: string, lang: string) {
  const m: Record<string, Record<string, string>> = {
    pro: { fr: "Pro", en: "Pro", ar: "Pro" },
    pro_plus: { fr: "Pro+", en: "Pro+", ar: "Pro+" },
    free: { fr: "Gratuit", en: "Free", ar: "مجاني" },
    free_expired: { fr: "Expiré", en: "Expired", ar: "منتهي" },
    none: { fr: "Gratuit", en: "Free", ar: "مجاني" },
    suspended: { fr: "Suspendu", en: "Suspended", ar: "موقوف" },
  };
  return m[plan]?.[lang] ?? plan;
}

function getPlanColor(plan: string) {
  const c: Record<string, string> = {
    free: "#95A5A6", free_expired: "#E74C3C", pro: "#2C3E8C",
    pro_plus: "#9B59B6", none: "#95A5A6", suspended: "#E74C3C",
  };
  return c[plan] ?? "#95A5A6";
}

function getPlanIcon(plan: string): keyof typeof Feather.glyphMap {
  if (plan === "pro_plus") return "layers";
  if (plan === "pro") return "briefcase";
  if (plan === "suspended") return "lock";
  return "user";
}

function getFrequencyLabel(freq: string, lang: string) {
  const m: Record<string, Record<string, string>> = {
    monthly: { fr: "Mensuel", en: "Monthly", ar: "شهري" },
    quarterly: { fr: "Trimestriel", en: "Quarterly", ar: "ربع سنوي" },
    annual_once: { fr: "Annuel (1 fois)", en: "Annual (once)", ar: "سنوي (مرة)" },
    annual_monthly: { fr: "Annuel (mensuel)", en: "Annual (monthly)", ar: "سنوي (شهري)" },
  };
  return m[freq]?.[lang] ?? freq;
}

function formatDate(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleDateString(
      lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR",
      { day: "numeric", month: "long", year: "numeric" },
    );
  } catch { return iso; }
}

// ── Sub-components ────────────────────────────────────────────
function SettingsRow({ icon, iconColor, label, value, onPress, rightElement, isRTL = false }: {
  icon: keyof typeof Feather.glyphMap; iconColor: string; label: string;
  value?: string; onPress?: () => void; rightElement?: React.ReactNode; isRTL?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.6 : 1}
      style={[styles.settingsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <View style={[styles.rowIcon, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon} size={iconSize(18)} color={iconColor} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_400Regular", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
        {label}
      </Text>
      {value && <Text style={[styles.rowValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{value}</Text>}
      {rightElement}
      {onPress && !rightElement && <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={16} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

function SettingsSection({ title, children, isRTL = false }: { title?: string; children: React.ReactNode; isRTL?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.sectionWrap}>
      {title && <Text style={[styles.sectionHeader, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>{title}</Text>}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.border }]} />;
}

function BottomModal({ visible, onClose, title, children, colors }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={iconSize(22)} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function MerchantProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, language, setLanguage, logout, colorTheme, setColorTheme, merchantAccentColor, setMerchantAccentColor, isRTL } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isDark = colorTheme === "dark";
  const textAlign = isRTL ? "right" : "left";
  const rowDir = isRTL ? "row-reverse" : "row";
  const lang = (language as "fr" | "ar" | "en") ?? "fr";

  function l(fr: string, en: string, ar: string) {
    if (lang === "ar") return ar;
    if (lang === "en") return en;
    return fr;
  }

  // ── State ──
  const [merchant, setMerchant] = useState<any>(null);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [notifications, setNotifications] = useState(true);
  const [subscription, setSubscription] = useState<{
    plan: string; status: string; is_trial: boolean; days_left: number;
    is_active: boolean; max_stores: number; has_subscription: boolean; billing_cycle: BillingCycle;
  } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // ── Modal ──
  const [activeModal, setActiveModal] = useState<
    "none" | "info" | "rate" | "presets" | "lang" | "color" | "tier"
    | "sub" | "changePlan" | "requestSent" | "payment"
  >("none");

  function openModal(name: typeof activeModal) {
    if (activeModal !== "none") { setActiveModal("none"); setTimeout(() => setActiveModal(name), 320); }
    else setActiveModal(name);
  }
  function closeModal() { setActiveModal("none"); }

  // ── Plan request state ──
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedStores, setSelectedStores] = useState(2);
  const [requestingPlan, setRequestingPlan] = useState(false);

  // ── Payment upload state ──
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofFileName, setProofFileName] = useState<string | null>(null);

  // ── Activation code ──
  const [showActivationInput, setShowActivationInput] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activating, setActivating] = useState(false);

  // ── Form fields ──
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [bizName, setBizName] = useState("");
  const [category, setCategory] = useState("other");
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState("1");
  const [savingRate, setSavingRate] = useState(false);
  const [presets, setPresets] = useState<number[]>(DEFAULT_PRESETS);
  const [presetsInput, setPresetsInput] = useState("10,25,50,100,200,500");
  const [savingPresets, setSavingPresets] = useState(false);
  const [silverThreshold, setSilverThreshold] = useState("1000");
  const [goldThreshold, setGoldThreshold] = useState("5000");
  const [savingTiers, setSavingTiers] = useState(false);

  // ── Toast ──
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg); setToastType(type); setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
      loadMerchant();
    }, [isDark, user?.id]),
  );

  async function loadMerchant() {
    if (!user?.id) return;
    const { data } = await supabase.from("merchants").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) return;

    setMerchant(data);
    setBizName(data.business_name ?? "");
    setCategory(data.category ?? "other");
    setRate(String(data.points_rate ?? 1));
    setSilverThreshold(String(data.silver_threshold ?? 1000));
    setGoldThreshold(String(data.gold_threshold ?? 5000));
    if (data.quick_points) {
      const pts = data.quick_points.split(",").map(Number).filter((n: number) => !isNaN(n) && n > 0);
      setPresets(pts); setPresetsInput(data.quick_points);
    }

    const { data: statsData } = await supabase
      .from("merchant_stats").select("total_customers")
      .eq("merchant_id", data.id).maybeSingle();
    setTotalCustomers(statsData?.total_customers ?? 0);

    const { data: subData } = await supabase.rpc("check_merchant_access", { p_merchant_id: data.id });
    if (subData?.[0]) {
      const { data: subRow } = await supabase.from("subscriptions")
        .select("billing_cycle").eq("merchant_id", data.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setSubscription({ ...subData[0], billing_cycle: (subRow?.billing_cycle ?? "monthly") as BillingCycle });
    }

    // Demande en attente
    const { data: reqData } = await supabase.from("plan_requests")
      .select("*").eq("merchant_id", data.id).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setPendingRequest(reqData ?? null);

    // Infos paiement actuel
    const { data: payInfo } = await supabase.from("merchant_payment_info")
      .select("*").eq("merchant_id", data.id).maybeSingle();
    setPaymentInfo(payInfo ?? null);

    // Historique 3 derniers paiements
    const { data: payHist } = await supabase.from("payments")
      .select("*").eq("merchant_id", data.id)
      .order("created_at", { ascending: false }).limit(3);
    setPaymentHistory(payHist ?? []);
  }

  // ── Computed plan values ──
  const planKey = subscription?.plan ?? "none";
  const planColor = getPlanColor(planKey);
  const planLabel = getPlanDisplayLabel(planKey, lang);
  const planIcon = getPlanIcon(planKey);
  const isTrial = subscription?.is_trial ?? false;
  const isActive = subscription?.is_active ?? false;
  const daysLeft = subscription?.days_left ?? 0;
  const isSuspended = planKey === "suspended";
  const currentCycleKnown = subscription?.billing_cycle === "monthly" || subscription?.billing_cycle === "annual";
  const currentCycle = subscription?.billing_cycle ?? "unknown";

  function getPlanBadgeLabel() {
    if (isSuspended) return l("Compte suspendu", "Account suspended", "حساب موقوف");
    if (!subscription?.has_subscription) return l("Gratuit", "Free", "مجاني");
    if (isTrial) {
      if (daysLeft <= 7) return `${planLabel} — ${l("Essai", "Trial", "تجريبي")} · J-${daysLeft}`;
      return `${planLabel} — ${l("Essai", "Trial", "تجريبي")}`;
    }
    if (!isActive) return `${planLabel} — ${l("Expiré", "Expired", "منتهي")}`;
    if (daysLeft < 10 && daysLeft > 0) return `${planLabel} · J-${daysLeft}`;
    return planLabel;
  }

  function getStatusLabel() {
    if (isSuspended) return l("Suspendu", "Suspended", "موقوف");
    if (!subscription?.has_subscription || planKey === "none") return l("Plan gratuit", "Free plan", "خطة مجانية");
    if (isTrial) {
      if (daysLeft <= 7) return l(`Essai · ${daysLeft} jour(s)`, `Trial · ${daysLeft} day(s)`, `تجريبي · ${daysLeft} يوم`);
      return l("Essai", "Trial", "تجريبي");
    }
    if (!isActive) return l("Expiré", "Expired", "منتهي");
    if (daysLeft < 10) return l(`Expire dans ${daysLeft}j`, `Expires in ${daysLeft}d`, `ينتهي خلال ${daysLeft} يوم`);
    return l(
      `Actif · ${currentCycle === "annual" ? "Annuel" : "Mensuel"}`,
      `Active · ${currentCycle === "annual" ? "Annual" : "Monthly"}`,
      `نشط · ${currentCycle === "annual" ? "سنوي" : "شهري"}`,
    );
  }

  function getStatusColor() {
    if (isSuspended) return "#E74C3C";
    if (!isActive) return "#E74C3C";
    if (isTrial) return "#F9A602";
    if (daysLeft < 10) return "#E67E22";
    return "#27AE60";
  }

  // ── Payment row label ──
  function getPaymentRowLabel() {
    if (pendingRequest) return l("En attente de validation", "Pending validation", "قيد التحقق");
    if (isTrial) return l(`Essai gratuit · J-${daysLeft}`, `Free trial · ${daysLeft}d left`, `تجريبي · ${daysLeft} يوم`);
    if (paymentInfo) {
      const amount = paymentInfo.amount;
      const dueDate = formatDate(paymentInfo.next_payment_date, lang);
      return `${amount} DH · ${dueDate}`;
    }
    return l("Aucun paiement actif", "No active payment", "لا يوجد دفع نشط");
  }

  function getPaymentRowColor() {
    if (pendingRequest) return "#F9A602";
    if (isTrial) return "#F9A602";
    if (paymentInfo?.is_due_soon) return "#E67E22";
    if (paymentInfo) return "#27AE60";
    return "#E74C3C";
  }

  function getPaymentRowIcon(): keyof typeof Feather.glyphMap {
    if (pendingRequest) return "clock";
    if (isTrial) return "gift";
    if (paymentInfo) return "credit-card";
    return "alert-circle";
  }

  // ── Prix modaux ──
  const proPrice = billingCycle === "annual" ? PRO_PRICE.annual : PRO_PRICE.monthly;
  const proPriceSuffix = billingCycle === "annual" ? l("/an", "/year", "/سنة") : l("/mois", "/month", "/شهر");
  const selectedPP = PRO_PLUS_STORES.find((p) => p.stores === selectedStores) ?? PRO_PLUS_STORES[0];
  const ppPrice = billingCycle === "annual" ? selectedPP.annual : selectedPP.monthly;
  const ppPriceSuffix = proPriceSuffix;

  // ── Upload justificatif ──
  async function handlePickProof() {
    Alert.alert(
      l("Ajouter un justificatif", "Add proof", "إضافة إيصال"),
      l("Choisissez la source", "Choose source", "اختر المصدر"),
      [
        {
          text: l("Photo", "Photo", "صورة"),
          onPress: handlePickImage,
        },
        {
          text: l("Document (PDF)", "Document (PDF)", "مستند PDF"),
          onPress: handlePickDocument,
        },
        { text: l("Annuler", "Cancel", "إلغاء"), style: "cancel" },
      ],
    );
  }

  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast(l("Permission refusée", "Permission denied", "تم رفض الإذن"), "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // ✅ Copier vers le cache d'abord comme AvatarPicker
      const cacheUri = FileSystem.cacheDirectory + `proof_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: asset.uri, to: cacheUri });
      await uploadProof(cacheUri, `proof_${Date.now()}.jpg`, "image/jpeg");
    }
  }

  async function handlePickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await uploadProof(asset.uri, asset.name, asset.mimeType ?? "application/pdf");
    }
  }

  async function uploadProof(uri: string, fileName: string, mimeType: string) {
    if (!merchant?.id || !user?.id) return;
    setUploadingProof(true);
    const currentPendingRequest = pendingRequest;
    try {
      // ✅ Copier vers le cache d'abord
      const cacheUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.copyAsync({ from: uri, to: cacheUri });

      const base64 = await FileSystem.readAsStringAsync(cacheUri, {
        encoding: "base64" as any,
      });
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const ext = fileName.split(".").pop() ?? "jpg";
      const path = `${user.id}/${merchant.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, byteArray, { contentType: mimeType, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      const proofUrl = urlData.publicUrl;

      if (currentPendingRequest) {
        await supabase.rpc("upload_payment_proof", {
          p_merchant_id: merchant.id,
          p_request_id: currentPendingRequest.id,
          p_proof_url: proofUrl,
        });
      } else if (paymentInfo) {
        const { data: lastPayment } = await supabase
          .from("payments").select("id")
          .eq("merchant_id", merchant.id).eq("status", "confirmed")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (lastPayment) {
          await supabase.from("payments")
            .update({ proof_url: proofUrl, proof_uploaded_at: new Date().toISOString() })
            .eq("id", lastPayment.id);
        }
      }

      setProofFileName(fileName);
      await loadMerchant();
      showToast(l("✓ Justificatif envoyé", "✓ Proof uploaded", "✓ تم إرسال الإيصال"));

      // ✅ currentPendingRequest au lieu de pendingRequest
      if (currentPendingRequest) {
        await supabase.functions.invoke("subscription-notif", {
          body: {
            type: "PLAN_REQUEST",
            record: { ...currentPendingRequest, proof_url: proofUrl },
          },
        });
      }

      setTimeout(() => {
        Alert.alert(
          l("Notifier l'équipe ?", "Notify the team?", "إشعار الفريق؟"),
          l(
            "Souhaitez-vous envoyer un message WhatsApp pour confirmer votre paiement ?",
            "Would you like to send a WhatsApp message to confirm your payment?",
            "هل تريد إرسال رسالة واتساب لتأكيد دفعتك؟",
          ),
          [
            { text: l("Non", "No", "لا"), style: "cancel" },
            {
              text: l("Oui", "Yes", "نعم"),
              onPress: () => Linking.openURL(
                `https://wa.me/${ADMIN_RIB.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                  lang === "ar"
                    ? "مرحباً، لقد أرسلت إيصال الدفع لاشتراك Fideliio. الرجاء التحقق."
                    : lang === "en"
                      ? "Hello, I've uploaded my payment proof for my Fideliio subscription. Please verify."
                      : "Bonjour, j'ai envoyé mon justificatif de paiement pour mon abonnement Fideliio. Merci de vérifier.",
                )}`,
              ),
            },
          ],
        );
      }, 500);
    } catch (e: any) {
      showToast(e?.message || l("Erreur upload", "Upload error", "خطأ في الرفع"), "error");
    } finally {
      setUploadingProof(false);
    }
  }
  // ── Plan request ──
  async function handlePlanRequest(pKey: "pro" | "pro_plus", maxStores: number) {
    if (!merchant?.id) return;
    if (pendingRequest) {
      showToast(l("Une demande est déjà en attente", "A request is already pending", "طلب قيد الانتظار"), "error");
      return;
    }
    const months = billingCycle === "annual" ? 12 : 1;
    const planName = pKey === "pro" ? "Pro" : `Pro+ · ${maxStores} ${l("commerces", "stores", "متاجر")}`;
    const price = pKey === "pro" ? `${proPrice} DH${proPriceSuffix}` : `${ppPrice} DH${ppPriceSuffix}`;
    closeModal();
    setTimeout(() => {
      Alert.alert(
        l("Confirmer la demande", "Confirm request", "تأكيد الطلب"),
        l(
          `Passer au plan ${planName} (${price}).\n\nEffectuez un virement bancaire. Notre équipe activera votre plan sous 24h.`,
          `Switch to ${planName} (${price}).\n\nMake a bank transfer. Our team will activate your plan within 24h.`,
          `التبديل إلى ${planName} (${price}).\n\nقم بتحويل بنكي. سيقوم فريقنا بالتفعيل خلال 24 ساعة.`,
        ),
        [
          { text: l("Annuler", "Cancel", "إلغاء"), style: "cancel" },
          { text: l("Envoyer", "Send", "إرسال"), onPress: () => submitPlanRequest(pKey, maxStores, months) },
        ],
      );
    }, 400);
  }

  async function submitPlanRequest(pKey: "pro" | "pro_plus", maxStores: number, months: number) {
    if (!merchant?.id) return;
    setRequestingPlan(true);
    try {
      const { data: result, error } = await supabase.rpc("request_plan_change", {
        p_merchant_id: merchant.id, p_plan: pKey,
        p_max_stores: maxStores, p_months: months, p_billing_cycle: billingCycle,
      });
      if (error) throw error;
      const res = Array.isArray(result) ? result[0] : result;
      if (!res?.success) throw new Error(res?.message ?? "Erreur");
      await supabase.functions.invoke("subscription-notif", {
        body: { type: "PLAN_REQUEST", record: { ...res, merchant_id: merchant.id, plan: pKey, max_stores: maxStores, months, billing_cycle: billingCycle, id: res.request_id } },
      });
      await loadMerchant();
      openModal("requestSent");
    } catch (e: any) {
      showToast(e?.message || l("Erreur", "Error", "خطأ"), "error");
    } finally {
      setRequestingPlan(false);
    }
  }

  // ── Activation ──
  async function handleActivate() {
    if (!activationCode.trim() || !merchant?.id) return;
    setActivating(true);
    try {
      const { data: result } = await supabase.rpc("activate_subscription", {
        p_merchant_id: merchant.id, p_code: activationCode.trim().toUpperCase(),
      });
      const res = Array.isArray(result) ? result[0] : result;
      if (!res?.success) { showToast(l("Code invalide ou expiré", "Invalid or expired code", "رمز غير صالح"), "error"); return; }
      setActivationCode(""); setShowActivationInput(false);
      await loadMerchant(); closeModal();
      showToast(l("✓ Abonnement activé !", "✓ Subscription activated!", "✓ تم تفعيل الاشتراك!"));
    } catch (e: any) {
      showToast(e?.message || l("Erreur", "Error", "خطأ"), "error");
    } finally {
      setActivating(false);
    }
  }

  // ── Other handlers ──
  async function handleLogoUploaded(url: string) {
    if (!merchant?.id) return;
    await supabase.from("merchants").update({ avatar_url: url }).eq("id", merchant.id);
    setMerchant((prev: any) => ({ ...prev, avatar_url: url }));
    showToast(l("✓ Logo mis à jour", "✓ Logo updated", "✓ تم تحديث الشعار"));
  }

  async function handleSaveInfo() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) { showToast(t("profile.invalidEmail"), "error"); return; }
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { firstName: firstName.trim(), lastName: lastName.trim(), first_name: firstName.trim(), last_name: lastName.trim() } });
      if (merchant?.id) await supabase.from("merchants").update({ business_name: bizName.trim() || merchant.business_name, category }).eq("id", merchant.id);
      await loadMerchant(); closeModal(); showToast("✓ " + t("profile.saveSuccess"));
    } catch { showToast(t("common.error"), "error"); }
    finally { setSaving(false); }
  }

  async function handleSaveRate() {
    const val = parseFloat(rate);
    if (isNaN(val) || val <= 0) { showToast(t("common.error"), "error"); return; }
    setSavingRate(true);
    try {
      if (merchant?.id) await supabase.from("merchants").update({ points_rate: val }).eq("id", merchant.id);
      await loadMerchant(); closeModal(); showToast("✓ " + t("profile.saveSuccess"));
    } catch { showToast(t("common.error"), "error"); }
    finally { setSavingRate(false); }
  }

  async function handleSavePresets() {
    const pts = presetsInput.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0);
    if (pts.length === 0) { showToast(t("common.error"), "error"); return; }
    setSavingPresets(true);
    try {
      if (merchant?.id) await supabase.from("merchants").update({ quick_points: pts.join(",") }).eq("id", merchant.id);
      setPresets(pts); closeModal(); showToast("✓ " + t("profile.saveSuccess"));
    } catch { showToast(t("common.error"), "error"); }
    finally { setSavingPresets(false); }
  }

  async function handleSaveTiers() {
    const silver = parseInt(silverThreshold), gold = parseInt(goldThreshold);
    if (isNaN(silver) || silver <= 0) { showToast(l("Seuil Silver invalide", "Invalid Silver threshold", "حد Silver غير صالح"), "error"); return; }
    if (isNaN(gold) || gold <= silver) { showToast(l("Gold doit être supérieur à Silver", "Gold must be greater than Silver", "Gold يجب أن يكون أكبر من Silver"), "error"); return; }
    setSavingTiers(true);
    try {
      if (merchant?.id) await supabase.from("merchants").update({ silver_threshold: silver, gold_threshold: gold }).eq("id", merchant.id);
      await loadMerchant(); closeModal(); showToast("✓ " + t("profile.saveSuccess"));
    } catch { showToast(t("common.error"), "error"); }
    finally { setSavingTiers(false); }
  }

  async function handleLogout() {
    Alert.alert(t("profile.logout"), "", [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.logout"), style: "destructive", onPress: async () => { await logout(); router.replace("/onboarding/language"); } },
    ]);
  }

  async function handleSwitchToCustomer() {
    Alert.alert(
      l("Passer en mode client", "Switch to customer mode", "التبديل إلى وضع العميل"),
      l("Vous allez accéder à votre espace client", "You'll be taken to your customer space", "ستنتقل إلى مساحة العميل"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: l("Basculer", "Switch", "تبديل"), onPress: async () => { await AsyncStorage.setItem("@active_role", "customer"); router.replace("/(customer)/home"); } },
      ],
    );
  }

  const rateDisplay = `1 pt = ${merchant?.points_rate ?? 1} DH`;
  const presetsDisplay = presets.slice(0, 3).join(", ") + (presets.length > 3 ? "..." : "");
  const tierDisplay = `🥈 ${merchant?.silver_threshold ?? 1000} · 🥇 ${merchant?.gold_threshold ?? 5000}`;
  const merchantInitials = (merchant?.business_name ?? user?.firstName ?? "M")[0].toUpperCase();

  // ── Render ──
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[styles.heroSection, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <AvatarPicker userId={user?.id ?? ""} currentUrl={merchant?.avatar_url} size={84} initials={merchantInitials} accentColor={merchantAccentColor} folder="merchant" onUploaded={handleLogoUploaded} />
          <Text style={[styles.heroName, { color: colors.foreground, fontFamily: "Inter_700Bold", marginTop: 8 }]}>{user?.firstName} {user?.lastName}</Text>
          <Text style={[styles.heroBiz, { color: merchantAccentColor, fontFamily: "Inter_600SemiBold" }]}>{merchant?.business_name ?? "—"}</Text>
          <Text style={[styles.heroEmail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{user?.email ?? user?.phone ?? ""}</Text>
          <TouchableOpacity onPress={() => openModal("sub")}
            style={[styles.planBadge, { backgroundColor: planColor + "15", borderColor: planColor + "40" }]}>
            <Feather name={planIcon} size={iconSize(13)} color={planColor} />
            <Text style={{ color: planColor, fontFamily: "Inter_700Bold", fontSize: fs(12) }}>{getPlanBadgeLabel()}</Text>
            <View style={[styles.planStatusDot, { backgroundColor: getStatusColor() }]} />
          </TouchableOpacity>
          {pendingRequest && (
            <View style={[styles.pendingBadge, { backgroundColor: "#F9A60220", borderColor: "#F9A60240" }]}>
              <Feather name="clock" size={iconSize(12)} color="#F9A602" />
              <Text style={{ color: "#F9A602", fontFamily: "Inter_600SemiBold", fontSize: fs(11) }}>
                {l("Demande de plan en attente", "Plan request pending", "طلب خطة قيد الانتظار")}
              </Text>
            </View>
          )}
        </View>

        {/* Mon info */}
        <SettingsSection title={t("profile.myInfo")} isRTL={isRTL}>
          <SettingsRow icon="user" iconColor={merchantAccentColor} label={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`} onPress={() => openModal("info")} isRTL={isRTL} />
          <Separator />
          <SettingsRow icon="mail" iconColor="#3498DB" label={user?.email ?? user?.phone ?? "—"} onPress={() => openModal("info")} isRTL={isRTL} />
          <Separator />
          <SettingsRow icon="briefcase" iconColor="#9B59B6" label={merchant?.business_name ?? "—"} value={t(`auth.categories.${merchant?.category ?? "other"}` as any)} onPress={() => openModal("info")} isRTL={isRTL} />
        </SettingsSection>

        {/* Mon commerce */}
        <SettingsSection title={l("Mon commerce", "My store", "متجري")} isRTL={isRTL}>
          <SettingsRow icon="zap" iconColor="#F9A602" label={t("profile.pointsRate")} value={rateDisplay} onPress={() => openModal("rate")} isRTL={isRTL} />
          <Separator />
          <SettingsRow icon="grid" iconColor={merchantAccentColor} label={l("Points rapides", "Quick points", "النقاط السريعة")} value={presetsDisplay} onPress={() => openModal("presets")} isRTL={isRTL} />
          <Separator />
          <SettingsRow icon="award" iconColor="#FFD700" label={l("Niveaux de fidélité", "Loyalty tiers", "مستويات الولاء")} value={tierDisplay} onPress={() => openModal("tier")} isRTL={isRTL} />
          <Separator />
          <SettingsRow icon="users" iconColor="#3498DB" label={t("merchant.activeCustomers")} value={String(totalCustomers)} isRTL={isRTL} />
        </SettingsSection>

        {/* Abonnement + Paiement */}
        <SettingsSection title={l("Abonnement", "Subscription", "الاشتراك")} isRTL={isRTL}>
          <SettingsRow icon={planIcon} iconColor={planColor} label={planLabel} onPress={() => openModal("sub")} isRTL={isRTL}
            rightElement={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.statusChip, { backgroundColor: getStatusColor() + "20" }]}>
                  <View style={[styles.planStatusDot, { backgroundColor: getStatusColor() }]} />
                  <Text style={{ color: getStatusColor(), fontFamily: "Inter_600SemiBold", fontSize: fs(11) }}>{getStatusLabel()}</Text>
                </View>
                <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={16} color={colors.mutedForeground} />
              </View>
            }
          />
          <Separator />
          {/* ── Ligne Paiement ── */}
          <SettingsRow
            icon={getPaymentRowIcon()}
            iconColor={getPaymentRowColor()}
            label={l("Paiement", "Payment", "الدفع")}
            onPress={() => openModal("payment")}
            isRTL={isRTL}
            rightElement={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.statusChip, { backgroundColor: getPaymentRowColor() + "20" }]}>
                  <View style={[styles.planStatusDot, { backgroundColor: getPaymentRowColor() }]} />
                  <Text style={{ color: getPaymentRowColor(), fontFamily: "Inter_600SemiBold", fontSize: fs(11) }} numberOfLines={1}>
                    {getPaymentRowLabel()}
                  </Text>
                </View>
                <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={16} color={colors.mutedForeground} />
              </View>
            }
          />
        </SettingsSection>

        {/* Préférences */}
        <SettingsSection title={l("Préférences", "Preferences", "التفضيلات")} isRTL={isRTL}>
          <SettingsRow icon="globe" iconColor="#3498DB" label={t("profile.language")} value={LANGS.find((l) => l.code === language)?.label} onPress={() => openModal("lang")} isRTL={isRTL} />
          <Separator />
          <SettingsRow icon="droplet" iconColor={merchantAccentColor} label={l("Couleur principale", "Main color", "اللون الرئيسي")} onPress={() => openModal("color")} isRTL={isRTL}
            rightElement={
              <View style={{ flexDirection: rowDir, alignItems: "center", gap: 6 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: merchantAccentColor }} />
                <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={16} color={colors.mutedForeground} />
              </View>
            }
          />
          <Separator />
          <SettingsRow icon={isDark ? "moon" : "sun"} iconColor={isDark ? "#9B59B6" : "#F9A602"}
            label={isDark ? l("Mode sombre", "Dark mode", "الوضع الداكن") : l("Mode clair", "Light mode", "الوضع الفاتح")}
            isRTL={isRTL}
            rightElement={<Switch value={isDark} onValueChange={(val) => setColorTheme(val ? "dark" : "light")} trackColor={{ false: colors.border, true: merchantAccentColor + "80" }} thumbColor={isDark ? merchantAccentColor : colors.mutedForeground} />}
          />
          <Separator />
          <SettingsRow icon="bell" iconColor="#E67E22" label={t("profile.notifications")} isRTL={isRTL}
            rightElement={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.border, true: merchantAccentColor + "80" }} thumbColor={notifications ? merchantAccentColor : colors.mutedForeground} />}
          />
        </SettingsSection>

        {/* Compte */}
        <SettingsSection title={l("Compte", "Account", "الحساب")} isRTL={isRTL}>
          <SettingsRow icon="user" iconColor="#FF6B6B" label={l("Passer en mode client", "Switch to customer mode", "التبديل إلى وضع العميل")} onPress={handleSwitchToCustomer} isRTL={isRTL} />
          <Separator />
          <SettingsRow icon="log-out" iconColor="#E67E22" label={t("profile.logout")} onPress={handleLogout} isRTL={isRTL} />
        </SettingsSection>
      </ScrollView>

      {/* ════════════════════════════════════════
          Modal PAIEMENT
      ════════════════════════════════════════ */}
      <BottomModal visible={activeModal === "payment"} onClose={closeModal} title={l("Paiement", "Payment", "الدفع")} colors={colors}>
        <ScrollView style={{ maxHeight: 580 }} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={{ padding: 20, gap: 16 }}>

            {/* ── Etat paiement actuel ── */}
            {isTrial ? (
              <View style={[styles.paymentCard, { backgroundColor: "#F9A60210", borderColor: "#F9A60230" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.paymentIconWrap, { backgroundColor: "#F9A60220" }]}>
                    <Feather name="gift" size={iconSize(22)} color="#F9A602" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#F9A602", fontFamily: "Inter_700Bold", fontSize: fs(16) }}>
                      {l("Essai gratuit", "Free trial", "تجربة مجانية")}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13), marginTop: 2 }}>
                      {l(`${daysLeft} jour(s) restant(s)`, `${daysLeft} day(s) left`, `${daysLeft} يوم متبقي`)}
                    </Text>
                  </View>
                  <View style={[styles.trialBadge, { backgroundColor: "#F9A60220", borderColor: "#F9A60240" }]}>
                    <Text style={{ color: "#F9A602", fontFamily: "Inter_700Bold", fontSize: fs(11) }}>J-{daysLeft}</Text>
                  </View>
                </View>
                {daysLeft <= 7 && (
                  <View style={[styles.alertBox, { backgroundColor: "#E74C3C10", borderColor: "#E74C3C20", marginTop: sp(12) }]}>
                    <Feather name="alert-triangle" size={iconSize(13)} color="#E74C3C" />
                    <Text style={{ color: "#E74C3C", fontFamily: "Inter_400Regular", fontSize: fs(12), flex: 1 }}>
                      {l("Votre essai se termine bientôt. Choisissez un plan pour ne pas perdre vos données.", "Your trial ends soon. Choose a plan to keep your data.", "تجربتك تنتهي قريباً. اختر خطة للحفاظ على بياناتك.")}
                    </Text>
                  </View>
                )}
              </View>
            ) : pendingRequest ? (
              <View style={[styles.paymentCard, { backgroundColor: "#F9A60210", borderColor: "#F9A60230" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.paymentIconWrap, { backgroundColor: "#F9A60220" }]}>
                    <Feather name="clock" size={iconSize(22)} color="#F9A602" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#F9A602", fontFamily: "Inter_700Bold", fontSize: fs(16) }}>
                      {l("Demande en attente", "Request pending", "طلب قيد الانتظار")}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), marginTop: 2 }}>
                      {l("Plan", "Plan", "الخطة")} : {getPlanDisplayLabel(pendingRequest.plan, lang)}
                      {pendingRequest.amount ? ` · ${pendingRequest.amount} DH` : ""}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(11), marginTop: 2 }}>
                      {l("Envoyée le", "Sent on", "أُرسل في")} {formatDate(pendingRequest.created_at, lang)}
                    </Text>
                  </View>
                </View>
                {/* Justificatif déjà uploadé ? */}
                {pendingRequest.proof_url ? (
                  <View style={[styles.proofUploaded, { backgroundColor: "#27AE6010", borderColor: "#27AE6030" }]}>
                    <Feather name="check-circle" size={iconSize(14)} color="#27AE60" />
                    <Text style={{ color: "#27AE60", fontFamily: "Inter_600SemiBold", fontSize: fs(12), flex: 1 }}>
                      {l("Justificatif envoyé · En attente de validation", "Proof uploaded · Awaiting validation", "تم إرسال الإيصال · في انتظار التحقق")}
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: sp(12), gap: sp(8) }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>
                      {l("Envoyez votre justificatif de virement pour accélérer la validation.", "Upload your transfer proof to speed up validation.", "أرسل إيصال التحويل لتسريع التحقق.")}
                    </Text>
                    <TouchableOpacity
                      onPress={handlePickProof}
                      disabled={uploadingProof}
                      style={[styles.uploadBtn, { borderColor: "#F9A602", backgroundColor: "#F9A60210" }]}
                    >
                      {uploadingProof
                        ? <ActivityIndicator size="small" color="#F9A602" />
                        : <Feather name="upload" size={iconSize(16)} color="#F9A602" />
                      }
                      <Text style={{ color: "#F9A602", fontFamily: "Inter_700Bold", fontSize: fs(14) }}>
                        {uploadingProof
                          ? l("Envoi...", "Uploading...", "جاري الرفع...")
                          : l("Ajouter le justificatif", "Add proof", "إضافة إيصال")
                        }
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : paymentInfo ? (
              <View style={[styles.paymentCard, { backgroundColor: (paymentInfo.is_due_soon ? "#E67E22" : "#27AE60") + "10", borderColor: (paymentInfo.is_due_soon ? "#E67E22" : "#27AE60") + "30" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: sp(12) }}>
                  <View style={[styles.paymentIconWrap, { backgroundColor: (paymentInfo.is_due_soon ? "#E67E22" : "#27AE60") + "20" }]}>
                    <Feather name="credit-card" size={iconSize(22)} color={paymentInfo.is_due_soon ? "#E67E22" : "#27AE60"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: paymentInfo.is_due_soon ? "#E67E22" : "#27AE60", fontFamily: "Inter_700Bold", fontSize: fs(16) }}>
                      {paymentInfo.amount} DH
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), marginTop: 2 }}>
                      {getFrequencyLabel(paymentInfo.payment_frequency, lang)}
                    </Text>
                  </View>
                  {paymentInfo.is_due_soon && (
                    <View style={[styles.trialBadge, { backgroundColor: "#E67E2220", borderColor: "#E67E2240" }]}>
                      <Text style={{ color: "#E67E22", fontFamily: "Inter_700Bold", fontSize: fs(10) }}>
                        J-{paymentInfo.days_until_due}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[styles.subDivider, { backgroundColor: colors.border }]} />
                <View style={{ gap: sp(8), marginTop: sp(12) }}>
                  {[
                    { icon: "calendar" as const, label: l("Prochain paiement", "Next payment", "الدفع القادم"), value: formatDate(paymentInfo.next_payment_date, lang) },
                    { icon: "layers" as const, label: l("Plan", "Plan", "الخطة"), value: getPlanDisplayLabel(paymentInfo.plan, lang) },
                    { icon: "refresh-cw" as const, label: l("Fréquence", "Frequency", "التكرار"), value: getFrequencyLabel(paymentInfo.payment_frequency, lang) },
                    { icon: "dollar-sign" as const, label: l("Paiement", "Payment", "الدفع"), value: paymentInfo.payment_method === "bank_transfer" ? l("Virement", "Transfer", "تحويل") : "CashPlus" },
                  ].map((row, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name={row.icon} size={iconSize(13)} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{row.label} :</Text>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: fs(12) }}>{row.value}</Text>
                    </View>
                  ))}
                </View>
                {/* Bouton upload renouvellement */}
                {paymentInfo.is_due_soon && (
                  <TouchableOpacity
                    onPress={handlePickProof}
                    disabled={uploadingProof}
                    style={[styles.uploadBtn, { borderColor: "#E67E22", backgroundColor: "#E67E2210", marginTop: sp(12) }]}
                  >
                    {uploadingProof
                      ? <ActivityIndicator size="small" color="#E67E22" />
                      : <Feather name="upload" size={iconSize(16)} color="#E67E22" />
                    }
                    <Text style={{ color: "#E67E22", fontFamily: "Inter_700Bold", fontSize: fs(14) }}>
                      {uploadingProof
                        ? l("Envoi...", "Uploading...", "جاري الرفع...")
                        : l("Envoyer le justificatif", "Upload proof", "إرسال الإيصال")
                      }
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={[styles.paymentCard, { backgroundColor: "#E74C3C10", borderColor: "#E74C3C30" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: sp(12) }}>
                  <View style={[styles.paymentIconWrap, { backgroundColor: "#E74C3C20" }]}>
                    <Feather name="alert-circle" size={iconSize(22)} color="#E74C3C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: fs(16) }}>
                      {l("Aucun paiement actif", "No active payment", "لا يوجد دفع نشط")}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), marginTop: 2 }}>
                      {l("Envoyez votre justificatif de virement après avoir choisi un plan.", "Upload your transfer proof after choosing a plan.", "أرسل إيصال التحويل بعد اختيار خطة.")}
                    </Text>
                  </View>
                </View>
                {/* ✅ Bouton upload toujours visible ici */}
                <TouchableOpacity
                  onPress={handlePickProof}
                  disabled={uploadingProof}
                  style={[styles.uploadBtn, { borderColor: "#E74C3C", backgroundColor: "#E74C3C10" }]}
                >
                  {uploadingProof
                    ? <ActivityIndicator size="small" color="#E74C3C" />
                    : <Feather name="upload" size={iconSize(16)} color="#E74C3C" />
                  }
                  <Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: fs(14) }}>
                    {uploadingProof
                      ? l("Envoi...", "Uploading...", "جاري الرفع...")
                      : l("Envoyer un justificatif", "Upload proof", "إرسال إيصال")
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── RIB ── */}
            <View style={[styles.ribBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(14), marginBottom: sp(10) }}>
                {l("Coordonnées bancaires", "Banking details", "معلومات بنكية")}
              </Text>
              {[
                { label: l("Bénéficiaire", "Beneficiary", "المستفيد"), value: ADMIN_RIB.name },
                { label: "RIB", value: ADMIN_RIB.rib },
                { label: l("Banque", "Bank", "البنك"), value: ADMIN_RIB.bank },
                { label: "WhatsApp", value: ADMIN_RIB.whatsappDisplay },
              ].map((row, i) => (
                <View key={i} style={[styles.ribRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{row.label}</Text>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(13) }}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* ── Historique paiements ── */}
            {paymentHistory.length > 0 && (
              <View style={{ gap: sp(8) }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: fs(12), textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {l("Historique", "History", "السجل")}
                </Text>
                {paymentHistory.map((p, i) => (
                  <View key={i} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.historyDot, { backgroundColor: p.status === "confirmed" ? "#27AE60" : p.status === "pending" ? "#F9A602" : "#E74C3C" }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: fs(13) }}>
                        {p.amount} DH · {getPlanDisplayLabel(p.plan, lang)}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(11) }}>
                        {formatDate(p.created_at, lang)} · {getFrequencyLabel(p.payment_frequency, lang)}
                      </Text>
                    </View>
                    <View style={[styles.historyStatus, {
                      backgroundColor: p.status === "confirmed" ? "#27AE6020" : p.status === "pending" ? "#F9A60220" : "#E74C3C20",
                    }]}>
                      <Text style={{
                        color: p.status === "confirmed" ? "#27AE60" : p.status === "pending" ? "#F9A602" : "#E74C3C",
                        fontFamily: "Inter_700Bold", fontSize: fs(10),
                      }}>
                        {p.status === "confirmed" ? l("Confirmé", "Confirmed", "مؤكد") : p.status === "pending" ? l("En attente", "Pending", "معلق") : l("Échoué", "Failed", "فشل")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Boutons action ── */}
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://wa.me/${ADMIN_RIB.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(l("Bonjour, j'ai une question concernant mon paiement Fideliio.", "Hello, I have a question about my Fideliio payment.", "مرحباً، لدي سؤال حول دفعتي في Fideliio."))}`)}
              style={styles.whatsappBtn}
            >
              <Feather name="message-circle" size={iconSize(18)} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: fs(14) }}>
                {l("Contacter via WhatsApp", "Contact via WhatsApp", "التواصل عبر واتساب")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomModal>

      {/* ════════════════════════════════════════
          Modal ABONNEMENT
      ════════════════════════════════════════ */}
      <BottomModal visible={activeModal === "sub"} onClose={closeModal} title={l("Mon abonnement", "My subscription", "اشتراكي")} colors={colors}>
        <KeyboardAwareScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={80}>
          <View style={{ padding: 20, gap: 16 }}>
            <View style={[styles.subCurrentCard, { backgroundColor: planColor + "10", borderColor: planColor + "30" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.subPlanIcon, { backgroundColor: planColor + "20" }]}>
                  <Feather name={planIcon} size={iconSize(24)} color={planColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: planColor, fontFamily: "Inter_700Bold", fontSize: fs(20) }}>{planLabel}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <View style={[styles.planStatusDot, { backgroundColor: getStatusColor() }]} />
                    <Text style={{ color: getStatusColor(), fontFamily: "Inter_600SemiBold", fontSize: fs(13) }}>{getStatusLabel()}</Text>
                  </View>
                </View>
                {isTrial && <View style={[styles.trialBadge, { backgroundColor: "#F9A60220", borderColor: "#F9A60240" }]}><Text style={{ color: "#F9A602", fontFamily: "Inter_700Bold", fontSize: fs(11) }}>{l("ESSAI", "TRIAL", "تجريبي")}</Text></View>}
                {isActive && !isTrial && <View style={[styles.trialBadge, { backgroundColor: "#27AE6020", borderColor: "#27AE6040" }]}><Text style={{ color: "#27AE60", fontFamily: "Inter_700Bold", fontSize: fs(11) }}>{l("ACTIF", "ACTIVE", "نشط")}</Text></View>}
                {isSuspended && <View style={[styles.trialBadge, { backgroundColor: "#E74C3C20", borderColor: "#E74C3C40" }]}><Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: fs(11) }}>{l("SUSPENDU", "SUSPENDED", "موقوف")}</Text></View>}
              </View>
              <View style={[styles.subDivider, { backgroundColor: planColor + "20" }]} />
              <View style={{ gap: sp(8) }}>
                {isTrial && daysLeft <= 7 && (
                  <View style={styles.subDetailRow}>
                    <Feather name="gift" size={iconSize(14)} color={planColor} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13) }}>
                      {l(`Essai gratuit — ${daysLeft} jour(s) restant(s)`, `Free trial — ${daysLeft} day(s) left`, `تجربة مجانية — ${daysLeft} يوم متبقي`)}
                    </Text>
                  </View>
                )}
                {isSuspended ? (
                  <View style={styles.subDetailRow}>
                    <Feather name="alert-circle" size={iconSize(14)} color="#E74C3C" />
                    <Text style={{ color: "#E74C3C", fontFamily: "Inter_400Regular", fontSize: fs(13) }}>
                      {l("Votre compte a été suspendu. Contactez le support.", "Your account has been suspended. Contact support.", "تم تعليق حسابك. اتصل بالدعم.")}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.subDetailRow}>
                      <Feather name="users" size={iconSize(14)} color={planColor} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13) }}>
                        {isActive && planKey !== "free" && planKey !== "none" ? l("Clients illimités", "Unlimited customers", "عملاء غير محدودين") : l("10 clients max", "10 customers max", "10 عملاء كحد أقصى")}
                      </Text>
                    </View>
                    {currentCycleKnown && isActive && !isTrial && (
                      <View style={styles.subDetailRow}>
                        <Feather name="calendar" size={iconSize(14)} color={planColor} />
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13) }}>
                          {currentCycle === "annual" ? l("Facturation annuelle", "Annual billing", "فوترة سنوية") : l("Facturation mensuelle", "Monthly billing", "فوترة شهرية")}
                        </Text>
                      </View>
                    )}
                    {planKey === "pro_plus" && (
                      <View style={styles.subDetailRow}>
                        <Feather name="home" size={iconSize(14)} color={planColor} />
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13) }}>
                          {l(`${subscription?.max_stores ?? 2} commerces actifs`, `${subscription?.max_stores ?? 2} active stores`, `${subscription?.max_stores ?? 2} متاجر نشطة`)}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            {pendingRequest && (
              <View style={[styles.trialInfoBox, { backgroundColor: "#F9A60210", borderColor: "#F9A60230" }]}>
                <Feather name="clock" size={iconSize(14)} color="#F9A602" />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), flex: 1, lineHeight: 18 }}>
                  {l("Votre demande est en cours de traitement. Notre équipe vous contactera sous 24h.", "Your request is being processed. Our team will contact you within 24h.", "طلبك قيد المعالجة. سيتصل بك فريقنا خلال 24 ساعة.")}
                </Text>
              </View>
            )}

            {isTrial && daysLeft <= 7 && !pendingRequest && (
              <View style={[styles.trialInfoBox, { backgroundColor: "#F9A60210", borderColor: "#F9A60230" }]}>
                <Feather name="info" size={iconSize(14)} color="#F9A602" />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), flex: 1, lineHeight: 18 }}>
                  {l("Votre essai se termine bientôt. Choisissez un plan pour continuer.", "Your trial is ending soon. Choose a plan to keep all features.", "تجربتك تنتهي قريباً. اختر خطة للاستمرار.")}
                </Text>
              </View>
            )}

            {!isSuspended && (
              <TouchableOpacity onPress={() => openModal("changePlan")} style={[styles.changePlanBtn, { borderColor: planColor }]}>
                <Feather name="refresh-cw" size={iconSize(16)} color={planColor} />
                <Text style={{ color: planColor, fontFamily: "Inter_700Bold", fontSize: fs(15) }}>
                  {pendingRequest ? l("Voir les plans", "View plans", "عرض الخطط") : l("Changer de plan", "Change plan", "تغيير الخطة")}
                </Text>
              </TouchableOpacity>
            )}

            {isSuspended && (
              <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${ADMIN_RIB.whatsapp.replace(/\D/g, "")}`)} style={[styles.changePlanBtn, { borderColor: "#E74C3C" }]}>
                <Feather name="message-circle" size={iconSize(16)} color="#E74C3C" />
                <Text style={{ color: "#E74C3C", fontFamily: "Inter_700Bold", fontSize: fs(15) }}>
                  {l("Contacter le support", "Contact support", "اتصل بالدعم")}
                </Text>
              </TouchableOpacity>
            )}

            {!isSuspended && (
              <>
                <TouchableOpacity onPress={() => { setShowActivationInput(!showActivationInput); setActivationCode(""); }}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 }}>
                  <Feather name={showActivationInput ? "chevron-up" : "chevron-down"} size={iconSize(14)} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13) }}>
                    {l("J'ai un code d'activation", "I have an activation code", "لدي رمز تفعيل")}
                  </Text>
                </TouchableOpacity>
                {showActivationInput && (
                  <View style={[styles.activationBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <TextInput
                      value={activationCode} onChangeText={(text) => setActivationCode(text.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX" placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="characters"
                      style={[styles.codeInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: activationCode ? planColor : colors.border, fontFamily: "Inter_700Bold" }]}
                    />
                    <Button title={activating ? l("Activation...", "Activating...", "جاري التفعيل...") : l("Activer", "Activate", "تفعيل")}
                      onPress={handleActivate} loading={activating} style={{ backgroundColor: planColor, opacity: !activationCode.trim() ? 0.5 : 1 }} />
                  </View>
                )}
              </>
            )}
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      {/* ════════════════════════════════════════
          Modal DEMANDE ENVOYÉE
      ════════════════════════════════════════ */}
      <BottomModal visible={activeModal === "requestSent"} onClose={closeModal} title={l("Demande envoyée ✓", "Request sent ✓", "تم الإرسال ✓")} colors={colors}>
        <View style={{ padding: 20, gap: 16 }}>
          <View style={[styles.successBox, { backgroundColor: "#27AE6010", borderColor: "#27AE6030" }]}>
            <Feather name="check-circle" size={iconSize(32)} color="#27AE60" />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(16), textAlign: "center" }}>
              {l("Demande envoyée avec succès !", "Request sent successfully!", "تم إرسال الطلب بنجاح!")}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13), textAlign: "center", lineHeight: 20 }}>
              {l("Effectuez votre virement puis envoyez le justificatif depuis la section Paiement.", "Make your transfer then upload the proof from the Payment section.", "قم بالتحويل ثم أرسل الإيصال من قسم الدفع.")}
            </Text>
          </View>
          <View style={[styles.ribBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(14), marginBottom: sp(10) }}>
              {l("Coordonnées bancaires", "Banking details", "معلومات بنكية")}
            </Text>
            {[
              { label: l("Bénéficiaire", "Beneficiary", "المستفيد"), value: ADMIN_RIB.name },
              { label: "RIB", value: ADMIN_RIB.rib },
              { label: l("Banque", "Bank", "البنك"), value: ADMIN_RIB.bank },
            ].map((row, i) => (
              <View key={i} style={[styles.ribRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{row.label}</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(13) }}>{row.value}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://wa.me/${ADMIN_RIB.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(l("Bonjour, j'ai effectué le virement pour mon abonnement Fideliio.", "Hello, I've made the transfer for my Fideliio subscription.", "مرحباً، لقد أجريت التحويل لاشتراك Fideliio."))}`)}
            style={styles.whatsappBtn}
          >
            <Feather name="message-circle" size={iconSize(18)} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: fs(14) }}>
              {l("Confirmer par WhatsApp", "Confirm via WhatsApp", "تأكيد عبر واتساب")}
            </Text>
          </TouchableOpacity>
          <Button title={l("Fermer", "Close", "إغلاق")} onPress={closeModal} style={{ backgroundColor: colors.border }} />
        </View>
      </BottomModal>

      {/* ════════════════════════════════════════
          Modal CHANGEMENT DE PLAN
      ════════════════════════════════════════ */}
      <BottomModal visible={activeModal === "changePlan"} onClose={closeModal} title={l("Choisir un plan", "Choose a plan", "اختر خطة")} colors={colors}>
        <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={{ padding: 16, gap: 14 }}>
            {pendingRequest && (
              <View style={[styles.trialInfoBox, { backgroundColor: "#F9A60210", borderColor: "#F9A60230" }]}>
                <Feather name="clock" size={iconSize(14)} color="#F9A602" />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), flex: 1 }}>
                  {l("Une demande est déjà en cours. Attendez la confirmation.", "A request is already pending. Wait for confirmation.", "طلب قيد الانتظار. انتظر التأكيد.")}
                </Text>
              </View>
            )}
            <View style={[styles.billingToggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {(["monthly", "annual"] as const).map((cycle) => (
                <TouchableOpacity key={cycle} onPress={() => setBillingCycle(cycle)}
                  style={[styles.billingBtn, billingCycle === cycle && { backgroundColor: merchantAccentColor }]}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: billingCycle === cycle ? "#fff" : colors.mutedForeground }}>
                    {cycle === "monthly" ? l("Mensuel", "Monthly", "شهري") : l("Annuel", "Annual", "سنوي")}
                  </Text>
                  {cycle === "annual" && (
                    <Text style={{ color: billingCycle === "annual" ? "#fff" : "#27AE60", fontFamily: "Inter_700Bold", fontSize: fs(10) }}>
                      {l("2 mois offerts", "2 months free", "شهران مجاناً")}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Plan Pro */}
            <View style={[styles.changePlanCard, { borderColor: "#2C3E8C40", backgroundColor: "#2C3E8C06" }]}>
              <View style={[styles.changePlanPopBadge, { backgroundColor: "#2C3E8C" }]}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: fs(10) }}>{l("Le plus populaire", "Most popular", "الأكثر شيوعاً")}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: sp(10) }}>
                <View style={[styles.changePlanIconWrap, { backgroundColor: "#2C3E8C20" }]}>
                  <Feather name="briefcase" size={iconSize(20)} color="#2C3E8C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#2C3E8C", fontFamily: "Inter_700Bold", fontSize: fs(17) }}>Pro</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{l("Pour un commerce actif", "For one active store", "لمتجر واحد نشط")}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(17) }}>{proPrice} DH</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(11) }}>{proPriceSuffix}</Text>
                </View>
              </View>
              <View style={{ gap: sp(5), marginBottom: sp(12) }}>
                {[l("Clients illimités", "Unlimited customers", "عملاء غير محدودين"), l("1 commerce actif", "1 active store", "متجر واحد نشط"), l("Session unique (1 appareil)", "Single session (1 device)", "جهاز واحد فقط")].map((f, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="check" size={iconSize(12)} color="#2C3E8C" />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{f}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={() => !pendingRequest && handlePlanRequest("pro", 1)} disabled={!!pendingRequest || requestingPlan}
                style={[styles.changePlanCta, { backgroundColor: pendingRequest ? "#2C3E8C40" : "#2C3E8C" }]}>
                {requestingPlan ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: fs(14) }}>
                    {pendingRequest ? l("Demande en cours", "Request pending", "طلب قيد الانتظار") : l("Demander Pro", "Request Pro", "طلب Pro")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Plan Pro+ */}
            <View style={[styles.changePlanCard, { borderColor: "#9B59B640", backgroundColor: "#9B59B606" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: sp(10) }}>
                <View style={[styles.changePlanIconWrap, { backgroundColor: "#9B59B620" }]}>
                  <Feather name="layers" size={iconSize(20)} color="#9B59B6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#9B59B6", fontFamily: "Inter_700Bold", fontSize: fs(17) }}>Pro+</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{l("Pour plusieurs commerces", "For multiple stores", "لعدة متاجر")}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(17) }}>{ppPrice} DH</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(11) }}>{ppPriceSuffix}</Text>
                </View>
              </View>
              <View style={{ gap: sp(5), marginBottom: sp(12) }}>
                {[l("Clients illimités", "Unlimited customers", "عملاء غير محدودين"), l("2 à 5 commerces actifs", "2 to 5 active stores", "2 إلى 5 متاجر"), l("Multi-appareils", "Multi-device", "متعدد الأجهزة")].map((f, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="check" size={iconSize(12)} color="#9B59B6" />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{f}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), marginBottom: sp(8) }}>{l("Nombre de commerces", "Number of stores", "عدد المتاجر")}</Text>
              <View style={styles.storesGrid}>
                {PRO_PLUS_STORES.map((opt) => {
                  const price = billingCycle === "annual" ? opt.annual : opt.monthly;
                  const isSel = selectedStores === opt.stores;
                  return (
                    <TouchableOpacity key={opt.stores} onPress={() => setSelectedStores(opt.stores)}
                      style={[styles.storeOption, { borderColor: isSel ? "#9B59B6" : colors.border, backgroundColor: isSel ? "#9B59B610" : colors.card }]}>
                      <Text style={{ color: isSel ? "#9B59B6" : colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(18) }}>{opt.stores}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(10) }}>{l("commerces", "stores", "متاجر")}</Text>
                      <Text style={{ color: isSel ? "#9B59B6" : colors.foreground, fontFamily: "Inter_700Bold", fontSize: fs(12) }}>{price} DH</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity onPress={() => !pendingRequest && handlePlanRequest("pro_plus", selectedStores)} disabled={!!pendingRequest || requestingPlan}
                style={[styles.changePlanCta, { backgroundColor: pendingRequest ? "#9B59B640" : "#9B59B6", marginTop: sp(4) }]}>
                {requestingPlan ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: fs(14) }}>
                    {pendingRequest ? l("Demande en cours", "Request pending", "طلب قيد الانتظار") : l("Demander Pro+", "Request Pro+", "طلب Pro+")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.paymentNote, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="info" size={iconSize(13)} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12), flex: 1, lineHeight: 18 }}>
                {l("Après envoi de votre demande, effectuez un virement. Notre équipe activera votre plan sous 24h.", "After sending your request, make a transfer. Our team will activate your plan within 24h.", "بعد إرسال طلبك، قم بتحويل. سيقوم فريقنا بالتفعيل خلال 24 ساعة.")}
              </Text>
            </View>
          </View>
        </ScrollView>
      </BottomModal>

      {/* ── Autres modals ── */}
      <BottomModal visible={activeModal === "info"} onClose={closeModal} title={t("profile.myInfo")} colors={colors}>
        <KeyboardAwareScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={60}>
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ flexDirection: rowDir, gap: 12 }}>
              <Input label={t("auth.firstName")} value={firstName} onChangeText={setFirstName} leftIcon="user" containerStyle={{ flex: 1 }} />
              <Input label={t("auth.lastName")} value={lastName} onChangeText={setLastName} leftIcon="user" containerStyle={{ flex: 1 }} />
            </View>
            <Input label={t("auth.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" leftIcon="mail" />
            <Input label={t("auth.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="smartphone" />
            <Input label={t("auth.businessName")} value={bizName} onChangeText={setBizName} leftIcon="briefcase" />
            <Text allowFontScaling={false} style={{ fontSize: fs(13), color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>{t("auth.businessCategory")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CATEGORY_KEYS.map((key) => (
                <TouchableOpacity key={key} onPress={() => setCategory(key)}
                  style={[styles.catChip, { borderColor: category === key ? merchantAccentColor : colors.border, backgroundColor: category === key ? merchantAccentColor + "15" : colors.background, borderWidth: category === key ? 2 : 1 }]}>
                  <Text allowFontScaling={false} style={{ fontSize: fs(12), color: category === key ? merchantAccentColor : colors.mutedForeground, fontFamily: category === key ? "Inter_600SemiBold" : "Inter_400Regular" }}>
                    {t(`auth.categories.${key}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title={t("common.save")} onPress={handleSaveInfo} loading={saving} style={{ backgroundColor: merchantAccentColor, marginTop: 8 }} />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      <BottomModal visible={activeModal === "rate"} onClose={closeModal} title={t("profile.pointsRate")} colors={colors}>
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={60} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 20, gap: 16 }}>
            <Text allowFontScaling={false} style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13), textAlign }}>
              {l("Combien de DH vaut 1 point pour votre client ?", "How many DH is 1 point worth?", "كم درهم يساوي 1 نقطة؟")}
            </Text>
            <Input label="1 pt = ? DH" placeholder="10" value={rate} onChangeText={setRate} keyboardType="decimal-pad" leftIcon="zap" />
            <Button title={t("common.save")} onPress={handleSaveRate} loading={savingRate} style={{ backgroundColor: merchantAccentColor }} />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      <BottomModal visible={activeModal === "presets"} onClose={closeModal} title={l("Points rapides", "Quick points", "النقاط السريعة")} colors={colors}>
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={60} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {presetsInput.split(",").map((p, i) => {
                const n = parseInt(p.trim());
                if (isNaN(n) || n <= 0) return null;
                return (
                  <View key={i} style={[styles.presetPreview, { borderColor: merchantAccentColor, backgroundColor: merchantAccentColor + "15" }]}>
                    <Text allowFontScaling={false} style={{ color: merchantAccentColor, fontFamily: "Inter_700Bold", fontSize: fs(14) }}>+{n}</Text>
                    <Text allowFontScaling={false} style={{ color: merchantAccentColor, fontFamily: "Inter_400Regular", fontSize: fs(11) }}>pts</Text>
                  </View>
                );
              })}
            </View>
            <TextInput value={presetsInput} onChangeText={setPresetsInput} placeholder="10,25,50,100,200,500"
              style={[styles.presetsInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              placeholderTextColor={colors.mutedForeground} />
            <Button title={t("common.save")} onPress={handleSavePresets} loading={savingPresets} style={{ backgroundColor: merchantAccentColor }} />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      <BottomModal visible={activeModal === "tier"} onClose={closeModal} title={l("Niveaux de fidélité", "Loyalty tiers", "مستويات الولاء")} colors={colors}>
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={60} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 20, gap: 20 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(13), lineHeight: 20, textAlign }}>
              {l("Les niveaux sont basés sur les points cumulés à vie — ils ne baissent jamais.", "Tiers are based on lifetime points — they never decrease.", "المستويات مبنية على النقاط المتراكمة مدى الحياة.")}
            </Text>
            <View style={[styles.tierPreview, { borderColor: colors.border }]}>
              {[
                { emoji: "🥉", label: "Bronze", color: "#CD7F32", desc: l("Dès 0 pts", "From 0 pts", "من 0 نقطة"), pts: "0" },
                { emoji: "🥈", label: "Silver", color: "#C0C0C0", desc: l(`Dès ${silverThreshold} pts`, `From ${silverThreshold} pts`, `من ${silverThreshold} نقطة`), pts: silverThreshold },
                { emoji: "🥇", label: "Gold", color: "#FFD700", desc: l(`Dès ${goldThreshold} pts`, `From ${goldThreshold} pts`, `من ${goldThreshold} نقطة`), pts: goldThreshold },
              ].map((tier, i) => (
                <View key={i} style={[styles.tierItem, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ fontSize: fs(24) }}>{tier.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tier.color, fontFamily: "Inter_700Bold", fontSize: fs(15) }}>{tier.label}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: fs(12) }}>{tier.desc}</Text>
                  </View>
                  <View style={[styles.tierBadge, { backgroundColor: tier.color + "20", borderColor: tier.color + "40" }]}>
                    <Text style={{ color: tier.color, fontFamily: "Inter_700Bold", fontSize: fs(12) }}>{tier.pts === "0" ? "0+" : `${tier.pts}+`}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Input placeholder="1000" value={silverThreshold} onChangeText={setSilverThreshold} keyboardType="number-pad" leftIcon="zap" label={l("Seuil Silver (points)", "Silver threshold (points)", "حد Silver (نقاط)")} />
            <Input placeholder="5000" value={goldThreshold} onChangeText={setGoldThreshold} keyboardType="number-pad" leftIcon="award" label={l("Seuil Gold (points)", "Gold threshold (points)", "حد Gold (نقاط)")} />
            {parseInt(goldThreshold) <= parseInt(silverThreshold) && silverThreshold && goldThreshold && (
              <View style={[styles.errorBox, { backgroundColor: "#E74C3C10", borderColor: "#E74C3C30" }]}>
                <Feather name="alert-circle" size={iconSize(14)} color="#E74C3C" />
                <Text style={{ color: "#E74C3C", fontFamily: "Inter_400Regular", fontSize: fs(12), flex: 1 }}>
                  {l("Le seuil Gold doit être supérieur au seuil Silver", "Gold must be greater than Silver", "Gold يجب أن يكون أكبر من Silver")}
                </Text>
              </View>
            )}
            <Button title={t("common.save")} onPress={handleSaveTiers} loading={savingTiers} style={{ backgroundColor: merchantAccentColor }} />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      <BottomModal visible={activeModal === "lang"} onClose={closeModal} title={t("profile.language")} colors={colors}>
        <View style={{ padding: 20, gap: 4 }}>
          {LANGS.map((l) => (
            <TouchableOpacity key={l.code} onPress={() => { setLanguage(l.code); closeModal(); }}
              style={[styles.langOption, { backgroundColor: language === l.code ? merchantAccentColor + "15" : "transparent", borderRadius: 12 }]}>
              <Text allowFontScaling={false} style={{ fontSize: fs(24) }}>{l.flag}</Text>
              <Text allowFontScaling={false} style={{ flex: 1, color: colors.foreground, fontFamily: language === l.code ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: fs(16) }}>{l.label}</Text>
              {language === l.code && <Feather name="check" size={iconSize(20)} color={merchantAccentColor} />}
            </TouchableOpacity>
          ))}
        </View>
      </BottomModal>

      <BottomModal visible={activeModal === "color"} onClose={closeModal} title={l("Couleur principale", "Main color", "اللون الرئيسي")} colors={colors}>
        <View style={{ padding: 20 }}>
          <View style={styles.swatchGrid}>
            {ACCENT_COLORS.map((swatch) => {
              const isSel = merchantAccentColor === swatch.value;
              return (
                <TouchableOpacity key={swatch.key} onPress={() => { setMerchantAccentColor(swatch.value); closeModal(); }}
                  style={[styles.swatchLarge, { backgroundColor: swatch.value, borderWidth: isSel ? 4 : 0, borderColor: "#fff", shadowColor: isSel ? swatch.value : "transparent", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: isSel ? 8 : 0, transform: [{ scale: isSel ? 1.1 : 1 }] }]}>
                  {isSel && <Feather name="check" size={iconSize(24)} color="white" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomModal>

      {toastVisible && (
        <View style={[styles.toast, { backgroundColor: toastType === "success" ? "#27AE60" : "#E74C3C" }]}>
          <Text style={[styles.toastText, { fontFamily: "Inter_600SemiBold" }]}>{toastMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroSection: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: 1, gap: 4 },
  heroName: { fontSize: fs(20) },
  heroBiz: { fontSize: fs(14) },
  heroEmail: { fontSize: fs(13), marginTop: 2 },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, marginTop: sp(10) },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, marginTop: sp(6) },
  planStatusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  sectionWrap: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { fontSize: fs(12), textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, paddingHorizontal: 4 },
  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  settingsRow: { paddingHorizontal: 16, paddingVertical: 14, alignItems: "center", gap: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: fs(15) },
  rowValue: { fontSize: fs(13) },
  separator: { height: 1, marginLeft: 64 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, zIndex: 10 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { fontSize: fs(18) },
  subCurrentCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: sp(12) },
  subPlanIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  subDivider: { height: 1 },
  subDetailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trialBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  changePlanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14 },
  trialInfoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  activationBox: { borderWidth: 1.5, borderRadius: 12, padding: 14, gap: sp(10) },
  codeInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: fs(18), letterSpacing: 3, textAlign: "center" },
  successBox: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: sp(12) },
  ribBox: { borderWidth: 1.5, borderRadius: 12, padding: 14 },
  ribRow: { paddingVertical: 10, gap: 2 },
  whatsappBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", borderRadius: 12, paddingVertical: 14 },
  paymentNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  billingToggle: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: sp(4) },
  billingBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, gap: 2 },
  changePlanCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, overflow: "hidden" },
  changePlanPopBadge: { position: "absolute", top: 0, right: 0, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10 },
  changePlanIconWrap: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  changePlanCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 11, minHeight: 44 },
  storesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: sp(12) },
  storeOption: { width: "47%", borderWidth: 1.5, borderRadius: 13, padding: 12, alignItems: "center", gap: 3 },
  langOption: { flexDirection: "row", alignItems: "center", gap: 16, padding: 14 },
  presetPreview: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, alignItems: "center", minWidth: 60 },
  presetsInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: fs(16), letterSpacing: 1 },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center", paddingVertical: 8 },
  swatchLarge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  tierPreview: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  tierItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  // ── Payment styles ──
  paymentCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
  paymentIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  uploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12 },
  proofUploaded: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: sp(10) },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  toast: { position: "absolute", bottom: 90, left: 24, right: 24, padding: 16, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8, zIndex: 1000 },
  toastText: { color: "white", fontSize: fs(14), textAlign: "center" },
});