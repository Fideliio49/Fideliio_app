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
  Share,
  Image,
} from "react-native";
import { fs, iconSize } from "@/utils/responsive";
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
import { AvatarPicker } from "@/components/AvatarPicker";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇲🇦" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
};

function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
  rightElement,
  destructive = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={styles.settingsRow}
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
          name="chevron-right"
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
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionWrap}>
      {title && (
        <Text
          style={[
            styles.sectionHeader,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
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

export default function CustomerProfileScreen() {
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
    accentColor,
    setAccentColor,
  } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isDark = colorTheme === "dark";

  const [customer, setCustomer] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
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
      if (Platform.OS === "android")
        StatusBar.setBackgroundColor(isDark ? "#121212" : "#F9FAFB", true);
      loadProfile();
    }, [isDark, user?.id]),
  );

  async function loadProfile() {
    if (!user?.id) return;
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!customerData) return;
    setCustomer(customerData);
    setFirstName(customerData.first_name ?? "");
    setLastName(customerData.last_name ?? "");
    setEmail(customerData.email ?? "");
    setPhone(customerData.phone ?? "");
    const { data: pointsData } = await supabase
      .from("customer_total_points")
      .select("total_points")
      .eq("customer_id", customerData.id)
      .maybeSingle();
    setTotalPoints(Math.max(0, pointsData?.total_points ?? 0));
  }

  // ✅ Sauvegarder l'URL avatar après upload
  async function handleAvatarUploaded(url: string) {
    const avatarUrl = url || null; // ✅ "" → null pour la suppression
    await supabase
      .from("customers")
      .update({ avatar_url: avatarUrl })
      .eq("user_id", user!.id);
    setCustomer((prev: any) => ({ ...prev, avatar_url: avatarUrl }));
    showToast(
      url
        ? language === "en"
          ? "✓ Photo updated"
          : "✓ Photo mise à jour"
        : language === "en"
          ? "✓ Photo deleted"
          : "✓ Photo supprimée",
    );
  }

  async function handleSaveInfo() {
    setSaving(true);
    try {
      await supabase
        .from("customers")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("user_id", user!.id);
      await loadProfile();
      setShowInfoModal(false);
      showToast(t("profile.saveSuccess"));
    } catch (err: any) {
      showToast(err.message || t("common.error"), "error");
    } finally {
      setSaving(false);
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
      language === "ar"
        ? "حذف الحساب؟"
        : language === "en"
          ? "Delete your account?"
          : "Supprimer votre compte ?",
      language === "ar"
        ? "هذا الإجراء لا يمكن التراجع عنه."
        : language === "en"
          ? "This action is irreversible."
          : "Cette action est irréversible.",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text:
            language === "ar"
              ? "حذف نهائي"
              : language === "en"
                ? "Delete permanently"
                : "Supprimer définitivement",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace("/onboarding/language");
            } catch (e: any) {
              Alert.alert(t("common.error"), e.message || "Erreur");
            }
          },
        },
      ],
    );
  }
  async function handleSwitchToMerchant() {
    if (!user?.id) return;
    try {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id, business_name, subscription_started")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!merchant) return;

      // ✅ Seul indicateur fiable — subscription_started
      if (!merchant.subscription_started) {
        await AsyncStorage.setItem("@active_role", "merchant");
        router.replace("/auth/merchant-setup");
        return;
      }

      // Commerce configuré → vérifier subscription
      const { data: sub } = await supabase.rpc("get_merchant_subscription", {
        p_merchant_id: merchant.id,
      });
      const subscription = sub?.[0];

      if (!subscription) {
        await supabase.rpc("start_merchant_trial", {
          p_merchant_id: merchant.id,
        });
        await AsyncStorage.setItem("@active_role", "merchant");
        router.replace("/(merchant)/home");
        return;
      }

      if (!subscription.is_active) {
        await AsyncStorage.setItem("@active_role", "merchant");
        router.replace("/auth/subscription-expired");
        return;
      }

      await AsyncStorage.setItem("@active_role", "merchant");
      router.replace("/(merchant)/home");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Une erreur s'est produite.");
    }
  }
  async function handleShareQr() {
    if (!customer?.qr_code) return;
    try {
      await Share.share({ message: `Mon code Fideliio : ${customer.qr_code}` });
    } catch {}
  }

  const tierColor = TIER_COLORS[customer?.tier ?? "bronze"];
  const labelMyInfo =
    language === "ar"
      ? "معلوماتي"
      : language === "en"
        ? "My information"
        : t("profile.myInfo");
  const labelPrefs =
    language === "ar"
      ? "التفضيلات"
      : language === "en"
        ? "Preferences"
        : "Préférences";
  const labelAccount =
    language === "ar" ? "الحساب" : language === "en" ? "Account" : "Compte";
  const labelColor =
    language === "ar"
      ? "اللون الرئيسي"
      : language === "en"
        ? "Main color"
        : "Couleur principale";
  const labelDarkMode = isDark
    ? language === "ar"
      ? "الوضع الداكن"
      : language === "en"
        ? "Dark mode"
        : "Mode sombre"
    : language === "ar"
      ? "الوضع الفاتح"
      : language === "en"
        ? "Light mode"
        : "Mode clair";
  const labelDelete =
    language === "ar"
      ? "حذف الحساب"
      : language === "en"
        ? "Delete my account"
        : "Supprimer mon compte";
  const labelShare =
    language === "ar" ? "مشاركة" : language === "en" ? "Share" : "Partager";
  const labelSwitchMerchant =
    language === "ar"
      ? "التبديل إلى وضع التاجر"
      : language === "en"
        ? "Switch to merchant mode"
        : "Passer en mode commerçant";

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
          {/* ✅ AvatarPicker customer */}
          <AvatarPicker
            userId={user?.id ?? ""}
            currentUrl={customer?.avatar_url}
            size={84}
            initials={`${(customer?.first_name?.[0] ?? "").toUpperCase()}${(customer?.last_name?.[0] ?? "").toUpperCase()}`}
            accentColor={accentColor}
            folder="customer"
            onUploaded={handleAvatarUploaded}
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
            {customer?.first_name} {customer?.last_name}
          </Text>
          {customer?.email && (
            <Text
              style={[
                styles.heroSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {customer.email}
            </Text>
          )}
          {customer?.phone && (
            <Text
              style={[
                styles.heroSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {customer.phone}
            </Text>
          )}

          <View style={styles.tierRow}>
            <View
              style={[
                styles.tierBadge,
                { borderColor: tierColor, backgroundColor: tierColor + "20" },
              ]}
            >
              <Text
                style={[
                  styles.tierText,
                  { color: tierColor, fontFamily: "Inter_700Bold" },
                ]}
              >
                {(customer?.tier ?? "bronze").toUpperCase()}
              </Text>
            </View>
            <Text
              style={[
                styles.tierPoints,
                { color: "#F9A602", fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {totalPoints} {t("common.points").toLowerCase()}
            </Text>
          </View>

          {customer?.qr_code && (
            <View style={styles.qrSection}>
              {/*<View style={styles.qrWrap}>
                <QRCode
                  value={customer.qr_code}
                  size={120}
                  color="#1a1a2e"
                  backgroundColor="white"
                />
              </View>*/}
              <Text
                style={[
                  styles.qrCode,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {customer.qr_code}
              </Text>
              <TouchableOpacity
                onPress={handleShareQr}
                style={[styles.shareBtn, { borderColor: accentColor + "40" }]}
              >
                <Feather
                  name="share-2"
                  size={iconSize(14)}
                  color={accentColor}
                />
                <Text
                  style={[
                    styles.shareText,
                    { color: accentColor, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {labelShare}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── MES INFORMATIONS ── */}
        <SettingsSection title={labelMyInfo}>
          <SettingsRow
            icon="user"
            iconColor={accentColor}
            label={`${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`}
            onPress={() => setShowInfoModal(true)}
          />
          <Separator />
          <SettingsRow
            icon="mail"
            iconColor="#3498DB"
            label={customer?.email ?? customer?.phone ?? "—"}
            onPress={() => setShowInfoModal(true)}
          />
          {customer?.phone && (
            <>
              <Separator />
              <SettingsRow
                icon="smartphone"
                iconColor="#27AE60"
                label={customer.phone}
                onPress={() => setShowInfoModal(true)}
              />
            </>
          )}
        </SettingsSection>

        {/* ── PRÉFÉRENCES ── */}
        <SettingsSection title={labelPrefs}>
          <SettingsRow
            icon="globe"
            iconColor="#3498DB"
            label={t("profile.language")}
            value={LANGS.find((l) => l.code === language)?.label}
            onPress={() => setShowLangModal(true)}
          />
          <Separator />
          <SettingsRow
            icon="droplet"
            iconColor={accentColor}
            label={labelColor}
            onPress={() => setShowColorModal(true)}
            rightElement={
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: accentColor,
                  }}
                />
                <Feather
                  name="chevron-right"
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
            label={labelDarkMode}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={(val) => setColorTheme(val ? "dark" : "light")}
                trackColor={{ false: colors.border, true: accentColor + "80" }}
                thumbColor={isDark ? accentColor : colors.mutedForeground}
              />
            }
          />
        </SettingsSection>

        {/* ── COMPTE ── */}
        <SettingsSection title={labelAccount}>
          <SettingsRow
            icon="briefcase"
            iconColor="#2C3E8C"
            label={labelSwitchMerchant}
            onPress={handleSwitchToMerchant}
          />
          <Separator />
          <SettingsRow
            icon="log-out"
            iconColor="#E67E22"
            label={t("profile.logout")}
            onPress={handleLogout}
          />
          {/*<Separator />
          <SettingsRow
            icon="trash-2"
            iconColor="#E74C3C"
            label={labelDelete}
            onPress={handleDeleteAccount}
            destructive
          />*/}
        </SettingsSection>
      </ScrollView>

      {/* ── Modals ── */}
      <BottomModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={labelMyInfo}
        colors={colors}
      >
        <KeyboardAwareScrollView
          style={{ maxHeight: 500 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={60}
        >
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
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
            <Button
              title={t("common.save")}
              onPress={handleSaveInfo}
              loading={saving}
              style={{ backgroundColor: accentColor, marginTop: 8 }}
            />
          </View>
        </KeyboardAwareScrollView>
      </BottomModal>

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
                    language === l.code ? accentColor + "15" : "transparent",
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
                <Feather name="check" size={iconSize(20)} color={accentColor} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomModal>

      <BottomModal
        visible={showColorModal}
        onClose={() => setShowColorModal(false)}
        title={labelColor}
        colors={colors}
      >
        <View style={{ padding: 20 }}>
          <View style={styles.swatchGrid}>
            {ACCENT_COLORS.map((swatch) => {
              const isSelected = accentColor === swatch.value;
              return (
                <TouchableOpacity
                  key={swatch.key}
                  onPress={() => {
                    setAccentColor(swatch.value);
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
  heroSub: { fontSize: fs(13), marginTop: 2 },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  tierText: { fontSize: fs(12) },
  tierPoints: { fontSize: fs(15) },
  qrSection: { alignItems: "center", marginTop: 16, gap: 8 },
  qrWrap: { padding: 14, backgroundColor: "white", borderRadius: 12 },
  qrCode: { fontSize: fs(11), letterSpacing: 1.2 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderRadius: 99,
  },
  shareText: { fontSize: fs(14) },
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
    flexDirection: "row",
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
  toastText: { color: "white", fontSize: fs(14), textAlign: "center" },
});
