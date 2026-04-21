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
import QRCode from "react-native-qrcode-svg";
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
        <Feather name={icon} size={18} color={iconColor} />
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
              <Feather name="x" size={22} color={colors.mutedForeground} />
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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);

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
      if (data.quick_points) {
        const pts = data.quick_points
          .split(",")
          .map(Number)
          .filter((n: number) => !isNaN(n) && n > 0);
        setPresets(pts);
        setPresetsInput(data.quick_points);
      }

      // ✅ Charger les stats depuis merchant_stats
      const { data: statsData } = await supabase
        .from("merchant_stats")
        .select("total_customers")
        .eq("merchant_id", data.id)
        .maybeSingle();
      setTotalCustomers(statsData?.total_customers ?? 0);
    }
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

  async function handleDeleteAccount() {
    Alert.alert(
      isRTL ? "حذف الحساب؟" : "Supprimer votre compte ?",
      isRTL
        ? "هذا الإجراء لا يمكن التراجع عنه."
        : "Cette action est irréversible.",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: isRTL ? "حذف نهائي" : "Supprimer définitivement",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace("/onboarding/language");
            } catch (e: any) {
              Alert.alert("Erreur", e.message || "Suppression échouée");
            }
          },
        },
      ],
    );
  }

  const rateDisplay = `1 pt = ${merchant?.points_rate ?? 1} DH`;
  const presetsDisplay =
    presets.slice(0, 3).join(", ") + (presets.length > 3 ? "..." : "");

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
          <View
            style={[
              styles.avatarWrap,
              { backgroundColor: merchantAccentColor + "20" },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: merchantAccentColor, fontFamily: "Inter_700Bold" },
              ]}
            >
              {(user?.firstName?.[0] ?? "").toUpperCase()}
              {(user?.lastName?.[0] ?? "").toUpperCase()}
            </Text>
          </View>
          <Text
            style={[
              styles.heroName,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
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
          {merchant?.qr_code && (
            <View style={styles.qrWrap}>
              <QRCode
                value={merchant.qr_code}
                size={120}
                color="#1a1a2e"
                backgroundColor="white"
              />
              <Text
                style={[
                  styles.qrCode,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {merchant.qr_code}
              </Text>
            </View>
          )}
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
          {/* ✅ totalCustomers depuis merchant_stats */}
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
            icon="log-out"
            iconColor="#E67E22"
            label={t("profile.logout")}
            onPress={handleLogout}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="trash-2"
            iconColor="#E74C3C"
            label={isRTL ? "حذف الحساب" : "Supprimer mon compte"}
            onPress={handleDeleteAccount}
            destructive
            isRTL={isRTL}
          />
        </SettingsSection>
      </ScrollView>

      {/* ── Modal Mes informations ── */}
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
              style={{
                fontSize: 13,
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
                    style={{
                      fontSize: 12,
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

      {/* ── Modal Taux de points ── */}
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
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
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
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
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

      {/* ─a�� Modal Presets rapides ── */}
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
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                textAlign,
              }}
            >
              {isRTL
                ? "أدخل قيم النقاط مفصولة بفواصل"
                : "Entrez les valeurs séparées par des virgules (max 6)"}
            </Text>
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
                      style={{
                        color: merchantAccentColor,
                        fontFamily: "Inter_700Bold",
                        fontSize: 14,
                      }}
                    >
                      +{n}
                    </Text>
                    <Text
                      style={{
                        color: merchantAccentColor,
                        fontFamily: "Inter_400Regular",
                        fontSize: 11,
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
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 11,
              }}
            >
              {isRTL
                ? "مثال: 10,25,50,100,200,500"
                : "Ex: 10,25,50,100,200,500"}
            </Text>
            <Button
              title={t("common.save")}
              onPress={handleSavePresets}
              loading={savingPresets}
              style={{ backgroundColor: merchantAccentColor }}
            />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

      {/* ── Modal Langue ── */}
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
              <Text style={{ fontSize: 24 }}>{l.flag}</Text>
              <Text
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontFamily:
                    language === l.code
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                  fontSize: 16,
                }}
              >
                {l.label}
              </Text>
              {language === l.code && (
                <Feather name="check" size={20} color={merchantAccentColor} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomModal>

      {/* ── Modal Couleur ── */}
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
                    <Feather name="check" size={24} color="white" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomModal>

      {/* ── Toast ── */}
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
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 28 },
  heroName: { fontSize: 20 },
  heroBiz: { fontSize: 14 },
  heroEmail: { fontSize: 13, marginTop: 2 },
  qrWrap: { alignItems: "center", marginTop: 16, gap: 8 },
  qrCode: { fontSize: 11, letterSpacing: 1 },
  sectionWrap: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: {
    fontSize: 12,
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
  // APRÈS
  rowLabel: { fontSize: 15, color: "#000" }, // overridé par colors.foreground inline
  rowValue: { fontSize: 13, color: "#666" }, // overridé par colors.mutedForeground inline
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
  modalTitle: { fontSize: 18 },
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
    fontSize: 16,
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
  toastText: { color: "white", fontSize: 14, textAlign: "center" },
});
