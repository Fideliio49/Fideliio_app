import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { fs, iconSize } from "@/utils/responsive";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { Input } from "@/components/ui/Input";
import { FideliioLogo } from "@/components/FideliioLogo";
import { resetPassword } from "@/lib/auth";

export default function ForgotScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isMerchant = role === "merchant";
  const gradientColors: [string, string] = isMerchant
    ? ["#2C3E8C", "#00B4D8"]
    : ["#FF6B6B", "#FF8E53"];
  const accent = isMerchant ? colors.blue : colors.coral;

  async function handleSend() {
    if (!value.trim()) return;
    setLoading(true);
    try {
      await resetPassword(value.trim());
      setSent(true);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Une erreur s'est produite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: "#fff" }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Platform.OS === "web" ? 80 : 60 }]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={iconSize(22)} color="#0f0f0f" />
        </TouchableOpacity>

        <View style={styles.center}>
          <FideliioLogo size={52} />
          <Text style={[styles.title, { color: "#0f0f0f", fontFamily: "Inter_700Bold" }]}>
            {t("auth.forgotTitle")}
          </Text>
          <Text style={[styles.sub, { color: "#6B7280", fontFamily: "Inter_400Regular" }]}>
            {t("auth.forgotSub")}
          </Text>
        </View>

        {sent ? (
          <View style={styles.successBox}>
            <View style={[styles.successIcon, { backgroundColor: colors.greenLight }]}>
              <Feather name="check-circle" size={iconSize(48)} color={colors.green} />
            </View>
            <Text style={[styles.successTitle, { color: "#0f0f0f", fontFamily: "Inter_700Bold" }]}>
              Email envoyé !
            </Text>
            <Text style={[styles.successSub, { color: "#6B7280", fontFamily: "Inter_400Regular" }]}>
              Vérifiez votre boîte mail ou votre téléphone.
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[{ color: accent, fontFamily: "Inter_600SemiBold", fontSize: fs(15), marginTop: 16 }]}>
                {t("auth.back")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Input
              label={t("auth.emailOrPhone")}
              placeholder="email@exemple.com"
              value={value}
              onChangeText={setValue}
              leftIcon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleSend} activeOpacity={0.88} disabled={loading || !value.trim()}>
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ctaBtn, { borderRadius: colors.radius, opacity: !value.trim() ? 0.5 : 1 }]}
              >
                <Text style={[styles.ctaText, { fontFamily: "Inter_600SemiBold" }]}>
                  {loading ? t("common.loading") : t("auth.resetPassword")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  backBtn: { marginBottom: 20 },
  center: { alignItems: "center", gap: 12, marginBottom: 32 },
  title: { fontSize: fs(22) },
  sub: { fontSize: fs(14), textAlign: "center", lineHeight: 20 },
  ctaBtn: { paddingVertical: 16, alignItems: "center", marginTop: 8 },
  ctaText: { color: "#fff", fontSize: fs(16) },
  successBox: { alignItems: "center", gap: 10 },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: fs(22) },
  successSub: { fontSize: fs(14), textAlign: "center" },
});
