import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient"; // ✅ ajouté

import { useColors } from "@/hooks/useColors";
import { useApp, Language } from "@/context/AppContext";
import { Button } from "@/components/ui/Button";
import { SplashAnimation } from "@/components/SplashAnimation";
import { fs } from "@/utils/responsive";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

export default function LanguageScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { language, setLanguage } = useApp();
  const router = useRouter();

  async function handleContinue() {
    router.push("/onboarding/slides");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ✅ LinearGradient à la place de View */}
      <LinearGradient
        colors={["#1a1a6e", "#2C3E8C", "#1a5276"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <Text
          allowFontScaling={false}
          style={[styles.appName, { fontFamily: "Inter_700Bold" }]}
        >
          Fideliio
        </Text>
        <SplashAnimation />
        <Text
          allowFontScaling={false}
          style={[styles.tagline, { fontFamily: "Inter_400Regular" }]}
        >
          {t("splash.tagline")}
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        <Text
          allowFontScaling={false}
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
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
                    borderColor: selected ? colors.coral : colors.border,
                    backgroundColor: selected ? colors.coralLight : colors.card,
                    borderWidth: selected ? 2 : 1.5,
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.langNative,
                    {
                      color: selected ? colors.coral : colors.foreground,
                      fontFamily: selected
                        ? "Inter_700Bold"
                        : "Inter_500Medium",
                    },
                  ]}
                >
                  {lang.label}
                </Text>
                {selected && (
                  <View
                    style={[
                      styles.checkDot,
                      { backgroundColor: colors.coral },
                    ]}
                  />
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
    paddingTop: 52,
    paddingBottom: 20,
    alignItems: "center",
    gap: 4,
    maxHeight: 440,
    overflow: "hidden",
  },
  appName: {
    fontSize: fs(28),
    color: "#fff",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: fs(14),
    color: "rgba(255,255,255,0.75)",
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 28,
  },
  title: {
    fontSize: fs(20),
    marginBottom: 16,
    textAlign: "center",
  },
  options: {
    gap: 10,
    flex: 1,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  langNative: {
    fontSize: fs(17),
    flex: 1,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  continueBtn: {
    marginTop: 20,
    marginBottom: 16,
  },
});