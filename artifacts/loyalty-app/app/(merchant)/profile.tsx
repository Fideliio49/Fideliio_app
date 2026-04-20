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
} from "react-native";
import QRCode from "react-native-qrcode-svg";
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

const CATEGORY_KEYS = ["restaurant", "clothing", "hairSalon", "hotel", "other"] as const;

// ── Composant ligne style Telegram ──────────────────────────
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
        <Text style={[styles.rowValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
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

// ── Section style Telegram ──────────────────────────────────
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
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

// ── Séparateur ──────────────────────────────────────────────
function Separator() {
  const colors = useColors();
  return <View style={[styles.separator, { backgroundColor: colors.border }]} />;
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

  // ── State merchant chargé depuis Supabase ──
  const [merchant, setMerchant] = useState<any>(null);
  const [notifications, setNotifications] = useState(true);

  // ── State édition ──
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [bizName, setBizName] = useState("");
  const [category, setCategory] = useState("other");
  const [saving, setSaving] = useState(false);

  // ── State taux de points ──
  const [rate, setRate] = useState("1");
  const [savingRate, setSavingRate] = useState(false);
  const [showRateEdit, setShowRateEdit] = useState(false);

  // ── Toast ──
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

  // ── Charger merchant depuis Supabase ──────────────────────
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
    }
  }

  // ── Sauvegarder les infos ─────────────────────────────────
  async function handleSaveInfo() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      showToast(t("profile.invalidEmail"), "error");
      return;
    }
    setSaving(true);
    try {
      // Mettre à jour auth metadata
      await supabase.auth.updateUser({
        data: {
          firstName: firstName.trim() || user?.firstName,
          lastName: lastName.trim() || user?.lastName,
          first_name: firstName.trim() || user?.firstName,
          last_name: lastName.trim() || user?.lastName,
        },
      });

      // Mettre à jour la table merchants
      if (merchant?.id) {
        const { error } = await supabase
          .from("merchants")
          .update({
            business_name: bizName.trim() || merchant.business_name,
            category,
          })
          .eq("id", merchant.id);
        if (error) throw error;
      }

      await loadMerchant();
      setIsEditing(false);
      showToast("✓ " + t("profile.saveSuccess"));
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Sauvegarder le taux de points ────────────────────────
  async function handleSaveRate() {
    const val = parseFloat(rate);
    if (isNaN(val) || val <= 0) {
      showToast(t("common.error"), "error");
      return;
    }
    setSavingRate(true);
    try {
      if (merchant?.id) {
        const { error } = await supabase
          .from("merchants")
          .update({ points_rate: val })
          .eq("id", merchant.id);
        if (error) throw error;
      }
      setShowRateEdit(false);
      showToast("✓ " + t("profile.saveSuccess"));
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSavingRate(false);
    }
  }

  // ── Logout ────────────────────────────────────────────────
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

  // ── Supprimer le compte ───────────────────────────────────
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
            await deleteAccount();
            router.replace("/onboarding/language");
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero profil style Telegram ── */}
        <View
          style={[
            styles.heroSection,
            { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <View style={[styles.avatarWrap, { backgroundColor: merchantAccentColor + "20" }]}>
            <Text style={[styles.avatarText, { color: merchantAccentColor, fontFamily: "Inter_700Bold" }]}>
              {(user?.firstName?.[0] ?? "").toUpperCase()}
              {(user?.lastName?.[0] ?? "").toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.heroName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={[styles.heroBiz, { color: merchantAccentColor, fontFamily: "Inter_600SemiBold" }]}>
            {merchant?.business_name ?? "—"}
          </Text>
          <Text style={[styles.heroEmail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {user?.email ?? user?.phone ?? ""}
          </Text>

          {/* QR code inline dans le hero */}
          {merchant?.qr_code && (
            <View style={styles.qrWrap}>
              <QRCode value={merchant.qr_code} size={120} color="#1a1a2e" backgroundColor="white" />
              <Text style={[styles.qrCode, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {merchant.qr_code}
              </Text>
            </View>
          )}
        </View>

        {/* ── Section : Mes informations ── */}
        <SettingsSection title={t("profile.myInfo")} isRTL={isRTL}>
          {!isEditing ? (
            <>
              <SettingsRow
                icon="user"
                iconColor={merchantAccentColor}
                label={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`}
                onPress={() => setIsEditing(true)}
                isRTL={isRTL}
              />
              <Separator />
              <SettingsRow
                icon="mail"
                iconColor="#3498DB"
                label={user?.email ?? "—"}
                onPress={() => setIsEditing(true)}
                isRTL={isRTL}
              />
              <Separator />
              <SettingsRow
                icon="smartphone"
                iconColor="#27AE60"
                label={user?.phone ?? "—"}
                onPress={() => setIsEditing(true)}
                isRTL={isRTL}
              />
              <Separator />
              <SettingsRow
                icon="briefcase"
                iconColor="#9B59B6"
                label={merchant?.business_name ?? "—"}
                value={t(`auth.categories.${merchant?.category ?? "other"}` as any)}
                onPress={() => setIsEditing(true)}
                isRTL={isRTL}
              />
            </>
          ) : (
            <View style={{ padding: 16, gap: 12 }}>
              <View style={[{ flexDirection: rowDir, gap: 12 }]}>
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
              <Text style={[styles.catLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium", textAlign }]}>
                {t("auth.businessCategory")}
              </Text>
              <View style={[styles.catGrid, { flexDirection: rowDir }]}>
                {CATEGORY_KEYS.map((key) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setCategory(key)}
                    style={[
                      styles.catChip,
                      {
                        borderColor: category === key ? merchantAccentColor : colors.border,
                        backgroundColor: category === key ? merchantAccentColor + "15" : colors.background,
                        borderWidth: category === key ? 2 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: category === key ? merchantAccentColor : colors.mutedForeground,
                        fontFamily: category === key ? "Inter_600SemiBold" : "Inter_400Regular",
                      }}
                    >
                      {t(`auth.categories.${key}` as any)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[{ flexDirection: rowDir, gap: 12, marginTop: 4 }]}>
                <Button
                  title={t("common.cancel")}
                  onPress={() => setIsEditing(false)}
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                />
                <Button
                  title={t("common.save")}
                  onPress={handleSaveInfo}
                  loading={saving}
                  size="sm"
                  style={{ flex: 1, backgroundColor: merchantAccentColor }}
                />
              </View>
            </View>
          )}
        </SettingsSection>

        {/* ── Section : Commerce ── */}
        <SettingsSection title={t("profile.businessInfo")} isRTL={isRTL}>
          <SettingsRow
            icon="zap"
            iconColor="#F9A602"
            label={t("profile.pointsRate")}
            value={`1 DH = ${merchant?.points_rate ?? 1} pts`}
            onPress={() => setShowRateEdit(!showRateEdit)}
            isRTL={isRTL}
          />
          {showRateEdit && (
            <View style={{ padding: 16, gap: 12 }}>
              <Input
                label={t("profile.pointsRate")}
                placeholder="1"
                value={rate}
                onChangeText={setRate}
                keyboardType="decimal-pad"
                leftIcon="zap"
              />
              <Button
                title={t("common.save")}
                onPress={handleSaveRate}
                loading={savingRate}
                size="sm"
                style={{ backgroundColor: merchantAccentColor }}
              />
            </View>
          )}
          <Separator />
          <SettingsRow
            icon="users"
            iconColor="#3498DB"
            label={t("merchant.activeCustomers")}
            value={String(merchant?.total_customers ?? 0)}
            isRTL={isRTL}
          />
          <Separator />
          <SettingsRow
            icon="trending-up"
            iconColor="#27AE60"
            label={t("merchant.pointsDistributed")}
            value={String(merchant?.points_this_month ?? 0)}
            isRTL={isRTL}
          />
        </SettingsSection>

        {/* ── Section : Préférences ── */}
        <SettingsSection title={isRTL ? "التفضيلات" : "Préférences"} isRTL={isRTL}>
          {/* Notifications */}
          <SettingsRow
            icon="bell"
            iconColor="#E67E22"
            label={t("profile.notifications")}
            isRTL={isRTL}
            rightElement={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.border, true: merchantAccentColor + "80" }}
                thumbColor={notifications ? merchantAccentColor : colors.mutedForeground}
              />
            }
          />
          <Separator />
          {/* Mode sombre */}
          <SettingsRow
            icon={isDark ? "moon" : "sun"}
            iconColor={isDark ? "#9B59B6" : "#F9A602"}
            label={isDark ? (isRTL ? "الوضع الداكن" : "Mode sombre") : (isRTL ? "الوضع الفاتح" : "Mode clair")}
            isRTL={isRTL}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={(val) => setColorTheme(val ? "dark" : "light")}
                trackColor={{ false: colors.border, true: merchantAccentColor + "80" }}
                thumbColor={isDark ? merchantAccentColor : colors.mutedForeground}
              />
            }
          />
        </SettingsSection>

        {/* ── Section : Couleur principale ── */}
        <SettingsSection title={isRTL ? "اللون الرئيسي" : "Couleur principale"} isRTL={isRTL}>
          <View style={[styles.swatchRow, { flexDirection: rowDir }]}>
            {ACCENT_COLORS.map((swatch) => {
              const isSelected = merchantAccentColor === swatch.value;
              return (
                <TouchableOpacity
                  key={swatch.key}
                  onPress={() => setMerchantAccentColor(swatch.value)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: swatch.value,
                      borderWidth: isSelected ? 3 : 2,
                      borderColor: isSelected ? "#fff" : "transparent",
                      transform: [{ scale: isSelected ? 1.2 : 1 }],
                      shadowColor: isSelected ? swatch.value : "transparent",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.5,
                      shadowRadius: 6,
                      elevation: isSelected ? 6 : 0,
                    },
                  ]}
                >
                  {isSelected && <Feather name="check" size={14} color="white" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsSection>

        {/* ── Section : Langue ── */}
        <SettingsSection title={t("profile.language")} isRTL={isRTL}>
          {LANGS.map((l, i) => (
            <React.Fragment key={l.code}>
              {i > 0 && <Separator />}
              <SettingsRow
                icon="globe"
                iconColor={language === l.code ? merchantAccentColor : colors.mutedForeground}
                label={`${l.flag}  ${l.label}`}
                isRTL={isRTL}
                onPress={() => setLanguage(l.code)}
                rightElement={
                  language === l.code ? (
                    <Feather name="check" size={18} color={merchantAccentColor} />
                  ) : undefined
                }
              />
            </React.Fragment>
          ))}
        </SettingsSection>

        {/* ── Section : Compte ── */}
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

      {/* ── Toast ── */}
      {toastVisible && (
        <View
          style={[
            styles.toast,
            { backgroundColor: toastType === "success" ? "#27AE60" : "#E74C3C" },
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
  // Hero
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

  // Settings rows
  sectionWrap: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
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
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 13 },
  separator: { height: 1, marginLeft: 64 },

  // Couleurs
  swatchRow: {
    padding: 16,
    gap: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  // Langue
  langRow: { flexDirection: "row", gap: 8 },
  langBtn: { flex: 1, padding: 10, alignItems: "center" },

  // Édition
  catLabel: { fontSize: 13, marginBottom: 4 },
  catGrid: { flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },

  // Toast
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