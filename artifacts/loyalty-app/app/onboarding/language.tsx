import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useApp, Language } from "@/context/AppContext";
import { Button } from "@/components/ui/Button";

const LANGUAGES: { code: Language; label: string; flag: string; native: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷", native: "Français" },
  { code: "ar", label: "Arabic", flag: "🇸🇦", native: "العربية" },
  { code: "en", label: "English", flag: "🇬🇧", native: "English" },
];

export default function LanguageScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { language, setLanguage } = useApp();
  const router = useRouter();

  async function handleContinue() {
    router.push("/onboarding/role");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.primary, colors.purple700]}
        style={styles.header}
      >
        <View style={styles.logoArea}>
          <View style={[styles.logoCircle, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Text style={styles.logoText}>★</Text>
          </View>
          <Text style={[styles.appName, { fontFamily: "Inter_700Bold" }]}>LoyaltyApp</Text>
          <Text style={[styles.tagline, { fontFamily: "Inter_400Regular" }]}>
            {t("splash.tagline")}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("language.select")}
        </Text>

        <View style={styles.options}>
          {LANGUAGES.map((lang) => {
            const selected = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => setLanguage(lang.code)}
                activeOpacity={0.8}
                style={[
                  styles.langOption,
                  {
                    borderRadius: colors.radius,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.accent : colors.card,
                    borderWidth: selected ? 2 : 1.5,
                  },
                ]}
              >
                <Text style={styles.flag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.langNative,
                    {
                      color: selected ? colors.primary : colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {lang.native}
                </Text>
                {selected && (
                  <View style={[styles.checkDot, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title={t("language.continue")}
          onPress={handleContinue}
          size="lg"
          style={styles.continueBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  logoArea: {
    alignItems: "center",
    gap: 8,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoText: {
    fontSize: 32,
    color: "#fff",
  },
  appName: {
    fontSize: 28,
    color: "#fff",
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  options: {
    gap: 12,
    flex: 1,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  flag: {
    fontSize: 28,
  },
  langNative: {
    fontSize: 17,
    flex: 1,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  continueBtn: {
    marginTop: 24,
    marginBottom: 16,
  },
});
