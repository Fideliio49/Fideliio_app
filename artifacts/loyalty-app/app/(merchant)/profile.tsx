import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
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

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇲🇦" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const CATEGORY_KEYS = [
  "restaurant",
  "clothing",
  "hairSalon",
  "hotel",
  "other",
] as const;
const DEFAULT_PRESETS = [10, 25, 50, 100, 200, 500];

function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
  rightElement,
  destructive = false,
  isRTL = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  isRTL?: boolean;
}) {
  const colors = useColors();
  const rowDir = isRTL ? "row-reverse" : "row";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={[styles.settingsRow, { flexDirection: rowDir }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon} size={iconSize(18)} color={iconColor} />
      </View>
      <Text
        style={[
          styles.rowLabel,
          {
            color: destructive ? "#E74C3C" : colors.foreground,
            fontFamily: "Inter_400Regular",
            flex: 1,
            textAlign: isRTL ? "right" : "left",
          },
        ]}
      >
        {label}
      </Text>
      {value && (
        <Text
          style={[
            styles.rowValue,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {value}
        </Text>
      )}
      {rightElement}
      {onPress && !rightElement && (
        <Feather
          name={isRTL ? "chevron-left" : "chevron-right"}
          size={16}
          color={colors.mutedForeground}
        />
      )}
    </TouchableOpacity>
  );
}

function SettingsSection({
  title,
  children,
  isRTL = false,
}: {
  title?: string;
  children: React.ReactNode;
  isRTL?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionWrap}>
      {title && (
        <Text
          style={[
            styles.sectionHeader,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_600SemiBold",
              textAlign: isRTL ? "right" : "left",
            },
          ]}
        >
          {title}
        </Text>
      )}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return (
    <View style={[styles.separator, { backgroundColor: colors.border }]} />
  );
}

function BottomModal({ visible, onClose, title, children, colors }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather
                name="x"
                size={iconSize(22)}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export default function MerchantProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const {
    user,
    language,
    setLanguage,
    logout,
    deleteAccount,
    colorTheme,
    setColorTheme,
    merchantAccentColor,
    setMerchantAccentColor,
    isRTL,
  } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isDark = colorTheme === "dark";
  const textAlign = isRTL ? "right" : "left";
  const rowDir = isRTL ? "row-reverse" : "row";

  const [merchant, setMerchant] = useState<any>(null);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [notifications, setNotifications] = useState(true);

  // Modals
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false); // ✅ nouveau

  // Champs
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

  // ✅ Seuils tier
  const [silverThreshold, setSilverThreshold] = useState("1000");
  const [goldThreshold, setGoldThreshold] = useState("5000");
  const [savingTiers, setSavingTiers] = useState(false);

  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
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
    const { data } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setMerchant(data);
      setBizName(data.business_name ?? "");
      setCategory(data.category ?? "other");
      setRate(String(data.points_rate ?? 1));
      setSilverThreshold(String(data.silver_threshold ?? 1000));
      setGoldThreshold(String(data.gold_threshold ?? 5000));
      if (data.quick_points) {
        const pts = data.quick_points
          .split(",")
          .map(Number)
          .filter((n: number) => !isNaN(n) && n > 0);
        setPresets(pts);
        setPresetsInput(data.quick_points);
      }
      const { data: statsData } = await supabase
        .from("merchant_stats")
        .select("total_customers")
        .eq("merchant_id", data.id)
        .maybeSingle();
      setTotalCustomers(statsData?.total_customers ?? 0);
    }
  }

  async function handleLogoUploaded(url: string) {
    if (!merchant?.id) return;
    await supabase
      .from("merchants")
      .update({ avatar_url: url })
      .eq("id", merchant.id);
    setMerchant((prev: any) => ({ ...prev, avatar_url: url }));
    showToast(
      language === "ar"
        ? "✓ تم تحديث الشعار"
        : language === "en"
          ? "✓ Logo updated"
          : "✓ Logo mis à jour",
    );
  }

  async function handleSaveInfo() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      showToast(t("profile.invalidEmail"), "error");
      return;
    }
    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      });
      if (merchant?.id)
        await supabase
          .from("merchants")
          .update({
            business_name: bizName.trim() || merchant.business_name,
            category,
          })
          .eq("id", merchant.id);
      await loadMerchant();
      setShowInfoModal(false);
      showToast("✓ " + t("profile.saveSuccess"));
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRate() {
    const val = parseFloat(rate);
    if (isNaN(val) || val <= 0) {
      showToast(t("common.error"), "error");
      return;
    }
    setSavingRate(true);
    try {
      if (merchant?.id)
        await supabase
          .from("merchants")
          .update({ points_rate: val })
          .eq("id", merchant.id);
      await loadMerchant();
      setShowRateModal(false);
      showToast("✓ " + t("profile.saveSuccess"));
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSavingRate(false);
    }
  }

  async function handleSavePresets() {
    const pts = presetsInput
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    if (pts.length === 0) {
      showToast(t("common.error"), "error");
      return;
    }
    setSavingPresets(true);
    try {
      if (merchant?.id)
        await supabase
          .from("merchants")
          .update({ quick_points: pts.join(",") })
          .eq("id", merchant.id);
      setPresets(pts);
      setShowPresetsModal(false);
      showToast("✓ " + t("profile.saveSuccess"));
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSavingPresets(false);
    }
  }

  // ✅ Sauvegarder les seuils tier
  async function handleSaveTiers() {
    const silver = parseInt(silverThreshold);
    const gold = parseInt(goldThreshold);

    if (isNaN(silver) || silver <= 0) {
      showToast(
        language === "en"
          ? "Invalid Silver threshold"
          : "Seuil Silver invalide",
        "error",
      );
      return;
    }
    if (isNaN(gold) || gold <= silver) {
      showToast(
        language === "en"
          ? "Gold must be greater than Silver"
          : "Gold doit être supérieur à Silver",
        "error",
      );
      return;
    }

    setSavingTiers(true);
    try {
      if (merchant?.id) {
        await supabase
          .from("merchants")
          .update({ silver_threshold: silver, gold_threshold: gold })
          .eq("id", merchant.id);
      }
      await loadMerchant();
      setShowTierModal(false);
      showToast("✓ " + t("profile.saveSuccess"));
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSavingTiers(false);
    }
  }

  async function handleLogout() {
    Alert.alert(t("profile.logout"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/onboarding/language");
        },
      },
    ]);
  }

  async function handleSwitchToCustomer() {
    Alert.alert(
      language === "ar"
        ? "التبديل إلى وضع العميل"
        : language === "en"
          ? "Switch to customer mode"
          : "Passer en mode client",
      language === "ar"
        ? "ستنتقل إلى مساحة العميل"
        : language === "en"
          ? "You'll be taken to your customer space"
          : "Vous allez accéder à votre espace client",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text:
            language === "ar"
              ? "تبديل"
              : language === "en"
                ? "Switch"
                : "Basculer",
          onPress: async () => {
            await AsyncStorage.setItem("@active_role", "customer");
            router.replace("/(customer)/home");
          },
        },
      ],
    );
  }

  const rateDisplay = `1 pt = ${merchant?.points_rate ?? 1} DH`;
  const presetsDisplay =
    presets.slice(0, 3).join(", ") + (presets.length > 3 ? "..." : "");
  const tierDisplay = `🥈 ${merchant?.silver_threshold ?? 1000} · 🥇 ${merchant?.gold_threshold ?? 5000}`;
  const merchantInitials = (merchant?.business_name ??
    user?.firstName ??
    "M")[0].toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View
          style={[
            styles.heroSection,
            {
              paddingTop: topPad + 12,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <AvatarPicker
            userId={user?.id ?? ""}
            currentUrl={merchant?.avatar_url}
            size={84}
            initials={merchantInitials}
            accentColor={merchantAccentColor}
            folder="merchant"
            onUploaded={handleLogoUploaded}
          />
          <Text
            style={[
              styles.heroName,
              {
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                marginTop: 8,
              },
            ]}
          >
            {user?.firstName} {user?.lastName}
          </Text>
          <Text
            style={[
              styles.heroBiz,
              { color: merchantAccentColor, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {merchant?.business_name ?? "—"}
          </Text>
          <Text
            style={[
              styles.heroEmail,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {user?.email ?? user?.phone ?? ""}
          </Text>
        </View>

        {/* ── MES INFORMATIONS ── */}
        <SettingsSection title={t("profile.myInfo")} isRTL={isRTL}>
          <SettingsRow
            icon="user"
            iconColor={merchantAccentColor}
            label={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`}
            onPress={() => setShowInfoModal(true)}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="mail"
            iconColor="#3498DB"
            label={user?.email ?? user?.phone ?? "—"}
            onPress={() => setShowInfoModal(true)}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="briefcase"
            iconColor="#9B59B6"
            label={merchant?.business_name ?? "—"}
            value={t(`auth.categories.${merchant?.category ?? "other"}` as any)}
            onPress={() => setShowInfoModal(true)}
            isRTL={isRTL}
          />
        </SettingsSection>

        {/* ── MON COMMERCE ── */}
        <SettingsSection title={isRTL ? "متجري" : "Mon commerce"} isRTL={isRTL}>
          <SettingsRow
            icon="zap"
            iconColor="#F9A602"
            label={t("profile.pointsRate")}
            value={rateDisplay}
            onPress={() => setShowRateModal(true)}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="grid"
            iconColor={merchantAccentColor}
            label={isRTL ? "النقاط السريعة" : "Points rapides"}
            value={presetsDisplay}
            onPress={() => setShowPresetsModal(true)}
            isRTL={isRTL}
          />
          <Separator />
          {/* ✅ Niveaux de fidélité */}
          <SettingsRow
            icon="award"
            iconColor="#FFD700"
            label={
              language === "ar"
                ? "مستويات الولاء"
                : language === "en"
                  ? "Loyalty tiers"
                  : "Niveaux de fidélité"
            }
            value={tierDisplay}
            onPress={() => setShowTierModal(true)}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="users"
            iconColor="#3498DB"
            label={t("merchant.activeCustomers")}
            value={String(totalCustomers)}
            isRTL={isRTL}
          />
        </SettingsSection>

        {/* ── PRÉFÉRENCES ── */}
        <SettingsSection
          title={isRTL ? "التفضيلات" : "Préférences"}
          isRTL={isRTL}
        >
          <SettingsRow
            icon="globe"
            iconColor="#3498DB"
            label={t("profile.language")}
            value={LANGS.find((l) => l.code === language)?.label}
            onPress={() => setShowLangModal(true)}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="droplet"
            iconColor={merchantAccentColor}
            label={isRTL ? "اللون الرئيسي" : "Couleur principale"}
            onPress={() => setShowColorModal(true)}
            isRTL={isRTL}
            rightElement={
              <View
                style={{ flexDirection: rowDir, alignItems: "center", gap: 6 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: merchantAccentColor,
                  }}
                />
                <Feather
                  name={isRTL ? "chevron-left" : "chevron-right"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
            }
          />
          <Separator />
          <SettingsRow
            icon={isDark ? "moon" : "sun"}
            iconColor={isDark ? "#9B59B6" : "#F9A602"}
            label={
              isDark
                ? isRTL
                  ? "الوضع الداكن"
                  : "Mode sombre"
                : isRTL
                  ? "الوضع الفاتح"
                  : "Mode clair"
            }
            isRTL={isRTL}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={(val) => setColorTheme(val ? "dark" : "light")}
                trackColor={{
                  false: colors.border,
                  true: merchantAccentColor + "80",
                }}
                thumbColor={
                  isDark ? merchantAccentColor : colors.mutedForeground
                }
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="bell"
            iconColor="#E67E22"
            label={t("profile.notifications")}
            isRTL={isRTL}
            rightElement={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{
                  false: colors.border,
                  true: merchantAccentColor + "80",
                }}
                thumbColor={
                  notifications ? merchantAccentColor : colors.mutedForeground
                }
              />
            }
          />
        </SettingsSection>

        {/* ── COMPTE ── */}
        <SettingsSection title={isRTL ? "الحساب" : "Compte"} isRTL={isRTL}>
          <SettingsRow
            icon="user"
            iconColor="#FF6B6B"
            label={
              language === "ar"
                ? "التبديل إلى وضع العميل"
                : language === "en"
                  ? "Switch to customer mode"
                  : "Passer en mode client"
            }
            onPress={handleSwitchToCustomer}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="log-out"
            iconColor="#E67E22"
            label={t("profile.logout")}
            onPress={handleLogout}
            isRTL={isRTL}
          />
        </SettingsSection>
      </ScrollView>

      {/* ── Modal infos ── */}
      <BottomModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("profile.myInfo")}
        colors={colors}
      >
        <KeyboardAwareScrollView
          style={{ maxHeight: 500 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={60}
        >
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ flexDirection: rowDir, gap: 12 }}>
              <Input
                label={t("auth.firstName")}
                value={firstName}
                onChangeText={setFirstName}
                leftIcon="user"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label={t("auth.lastName")}
                value={lastName}
                onChangeText={setLastName}
                leftIcon="user"
                containerStyle={{ flex: 1 }}
              />
            </View>
            <Input
              label={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail"
            />
            <Input
              label={t("auth.phone")}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftIcon="smartphone"
            />
            <Input
              label={t("auth.businessName")}
              value={bizName}
              onChangeText={setBizName}
              leftIcon="briefcase"
            />
            <Text
              allowFontScaling={false}
              style={{
                fontSize: fs(13),
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              }}
            >
              {t("auth.businessCategory")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CATEGORY_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setCategory(key)}
                  style={[
                    styles.catChip,
                    {
                      borderColor:
                        category === key ? merchantAccentColor : colors.border,
                      backgroundColor:
                        category === key
                          ? merchantAccentColor + "15"
                          : colors.background,
                      borderWidth: category === key ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontSize: fs(12),
                      color:
                        category === key
                          ? merchantAccentColor
                          : colors.mutedForeground,
                      fontFamily:
                        category === key
                          ? "Inter_600SemiBold"
                          : "Inter_400Regular",
                    }}
                  >
                    {t(`auth.categories.${key}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              title={t("common.save")}
              onPress={handleSaveInfo}
              loading={saving}
              style={{ backgroundColor: merchantAccentColor, marginTop: 8 }}
            />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      {/* ── Modal taux de points ── */}
      <BottomModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
        title={t("profile.pointsRate")}
        colors={colors}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          bottomOffset={60}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ padding: 20, gap: 16 }}>
            <Text
              allowFontScaling={false}
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: fs(13),
                textAlign,
              }}
            >
              {isRTL
                ? "كم درهم يساوي 1 نقطة؟"
                : "Combien de DH vaut 1 point pour votre client ?"}
            </Text>
            <Input
              label="1 pt = ? DH"
              placeholder="10"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              leftIcon="zap"
            />
            <Text
              allowFontScaling={false}
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: fs(12),
              }}
            >
              {isRTL
                ? "مثال: 10 → كل 10 درهم = 1 نقطة"
                : "Ex: 10 → le client gagne 1 pt tous les 10 DH dépensés"}
            </Text>
            <Button
              title={t("common.save")}
              onPress={handleSaveRate}
              loading={savingRate}
              style={{ backgroundColor: merchantAccentColor }}
            />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      {/* ── Modal points rapides ── */}
      <BottomModal
        visible={showPresetsModal}
        onClose={() => setShowPresetsModal(false)}
        title={isRTL ? "النقاط السريعة" : "Points rapides"}
        colors={colors}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          bottomOffset={60}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {presetsInput.split(",").map((p, i) => {
                const n = parseInt(p.trim());
                if (isNaN(n) || n <= 0) return null;
                return (
                  <View
                    key={i}
                    style={[
                      styles.presetPreview,
                      {
                        borderColor: merchantAccentColor,
                        backgroundColor: merchantAccentColor + "15",
                      },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: merchantAccentColor,
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(14),
                      }}
                    >
                      +{n}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: merchantAccentColor,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(11),
                      }}
                    >
                      pts
                    </Text>
                  </View>
                );
              })}
            </View>
            <TextInput
              value={presetsInput}
              onChangeText={setPresetsInput}
              placeholder="10,25,50,100,200,500"
              keyboardType="default"
              style={[
                styles.presetsInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              placeholderTextColor={colors.mutedForeground}
            />
            <Button
              title={t("common.save")}
              onPress={handleSavePresets}
              loading={savingPresets}
              style={{ backgroundColor: merchantAccentColor }}
            />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      {/* ✅ Modal niveaux de fidélité */}
      <BottomModal
        visible={showTierModal}
        onClose={() => setShowTierModal(false)}
        title={
          language === "ar"
            ? "مستويات الولاء"
            : language === "en"
              ? "Loyalty tiers"
              : "Niveaux de fidélité"
        }
        colors={colors}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          bottomOffset={60}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ padding: 20, gap: 20 }}>
            {/* Explication */}
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: fs(13),
                lineHeight: 20,
                textAlign,
              }}
            >
              {language === "ar"
                ? "يُحسب المستوى على أساس النقاط المتراكمة مدى الحياة — لا ينخفض أبداً حتى بعد استخدام المكافآت."
                : language === "en"
                  ? "Tiers are based on lifetime cumulated points — they never decrease, even after redeeming rewards."
                  : "Les niveaux sont basés sur les points cumulés à vie — ils ne baissent jamais, même après avoir utilisé des récompenses."}
            </Text>

            {/* Aperçu des tiers */}
            <View style={[styles.tierPreview, { borderColor: colors.border }]}>
              {[
                {
                  emoji: "🥉",
                  label: "Bronze",
                  color: "#CD7F32",
                  desc: language === "en" ? "From 0 pts" : "Dès 0 pts",
                  pts: "0",
                },
                {
                  emoji: "🥈",
                  label: "Silver",
                  color: "#C0C0C0",
                  desc:
                    language === "en"
                      ? `From ${silverThreshold} pts`
                      : `Dès ${silverThreshold} pts`,
                  pts: silverThreshold,
                },
                {
                  emoji: "🥇",
                  label: "Gold",
                  color: "#FFD700",
                  desc:
                    language === "en"
                      ? `From ${goldThreshold} pts`
                      : `Dès ${goldThreshold} pts`,
                  pts: goldThreshold,
                },
              ].map((tier, i) => (
                <View
                  key={i}
                  style={[
                    styles.tierItem,
                    i < 2 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: fs(24) }}>{tier.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: tier.color,
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(15),
                      }}
                    >
                      {tier.label}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(12),
                      }}
                    >
                      {tier.desc}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.tierBadge,
                      {
                        backgroundColor: tier.color + "20",
                        borderColor: tier.color + "40",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: tier.color,
                        fontFamily: "Inter_700Bold",
                        fontSize: fs(12),
                      }}
                    >
                      {tier.pts === "0" ? "0+" : `${tier.pts}+`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Seuil Silver */}
            <View style={{ gap: sp(8) }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={{ fontSize: fs(20) }}>🥈</Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: fs(14),
                  }}
                >
                  {language === "en" ? "Silver threshold" : "Seuil Silver"}
                </Text>
              </View>
              <Input
                placeholder="1000"
                value={silverThreshold}
                onChangeText={setSilverThreshold}
                keyboardType="number-pad"
                leftIcon="zap"
                label={language === "en" ? "Points required" : "Points requis"}
              />
            </View>

            {/* Seuil Gold */}
            <View style={{ gap: sp(8) }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={{ fontSize: fs(20) }}>🥇</Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: fs(14),
                  }}
                >
                  {language === "en" ? "Gold threshold" : "Seuil Gold"}
                </Text>
              </View>
              <Input
                placeholder="5000"
                value={goldThreshold}
                onChangeText={setGoldThreshold}
                keyboardType="number-pad"
                leftIcon="award"
                label={language === "en" ? "Points required" : "Points requis"}
              />
            </View>

            {/* Validation */}
            {parseInt(goldThreshold) <= parseInt(silverThreshold) &&
              silverThreshold &&
              goldThreshold && (
                <View
                  style={[
                    styles.errorBox,
                    { backgroundColor: "#E74C3C10", borderColor: "#E74C3C30" },
                  ]}
                >
                  <Feather
                    name="alert-circle"
                    size={iconSize(14)}
                    color="#E74C3C"
                  />
                  <Text
                    style={{
                      color: "#E74C3C",
                      fontFamily: "Inter_400Regular",
                      fontSize: fs(12),
                      flex: 1,
                    }}
                  >
                    {language === "en"
                      ? "Gold must be greater than Silver"
                      : "Le seuil Gold doit être supérieur au seuil Silver"}
                  </Text>
                </View>
              )}

            <Button
              title={t("common.save")}
              onPress={handleSaveTiers}
              loading={savingTiers}
              style={{ backgroundColor: merchantAccentColor }}
            />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      {/* ── Modal langue ── */}
      <BottomModal
        visible={showLangModal}
        onClose={() => setShowLangModal(false)}
        title={t("profile.language")}
        colors={colors}
      >
        <View style={{ padding: 20, gap: 4 }}>
          {LANGS.map((l) => (
            <TouchableOpacity
              key={l.code}
              onPress={() => {
                setLanguage(l.code);
                setShowLangModal(false);
              }}
              style={[
                styles.langOption,
                {
                  backgroundColor:
                    language === l.code
                      ? merchantAccentColor + "15"
                      : "transparent",
                  borderRadius: 12,
                },
              ]}
            >
              <Text allowFontScaling={false} style={{ fontSize: fs(24) }}>
                {l.flag}
              </Text>
              <Text
                allowFontScaling={false}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontFamily:
                    language === l.code
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                  fontSize: fs(16),
                }}
              >
                {l.label}
              </Text>
              {language === l.code && (
                <Feather
                  name="check"
                  size={iconSize(20)}
                  color={merchantAccentColor}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomModal>

      {/* ── Modal couleur ── */}
      <BottomModal
        visible={showColorModal}
        onClose={() => setShowColorModal(false)}
        title={isRTL ? "اللون الرئيسي" : "Couleur principale"}
        colors={colors}
      >
        <View style={{ padding: 20 }}>
          <View style={styles.swatchGrid}>
            {ACCENT_COLORS.map((swatch) => {
              const isSelected = merchantAccentColor === swatch.value;
              return (
                <TouchableOpacity
                  key={swatch.key}
                  onPress={() => {
                    setMerchantAccentColor(swatch.value);
                    setShowColorModal(false);
                  }}
                  style={[
                    styles.swatchLarge,
                    {
                      backgroundColor: swatch.value,
                      borderWidth: isSelected ? 4 : 0,
                      borderColor: "#fff",
                      shadowColor: isSelected ? swatch.value : "transparent",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      elevation: isSelected ? 8 : 0,
                      transform: [{ scale: isSelected ? 1.1 : 1 }],
                    },
                  ]}
                >
                  {isSelected && (
                    <Feather name="check" size={iconSize(24)} color="white" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomModal>

      {toastVisible && (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: toastType === "success" ? "#27AE60" : "#E74C3C",
            },
          ]}
        >
          <Text style={[styles.toastText, { fontFamily: "Inter_600SemiBold" }]}>
            {toastMsg}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    gap: 4,
  },
  heroName: { fontSize: fs(20) },
  heroBiz: { fontSize: fs(14) },
  heroEmail: { fontSize: fs(13), marginTop: 2 },
  sectionWrap: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: {
    fontSize: fs(12),
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  settingsRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 14,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: fs(15) },
  rowValue: { fontSize: fs(13) },
  separator: { height: 1, marginLeft: 64 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: { fontSize: fs(18) },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 14,
  },
  presetPreview: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    minWidth: 60,
  },
  presetsInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: fs(16),
    letterSpacing: 1,
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
    paddingVertical: 8,
  },
  swatchLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // ✅ Tier styles
  tierPreview: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  tierItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toast: {
    position: "absolute",
    bottom: 90,
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  toastText: { color: "white", fontSize: fs(14), textAlign: "center" },
});
