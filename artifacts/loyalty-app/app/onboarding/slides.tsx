import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  FlatList,
  Platform,
  ListRenderItemInfo,
} from "react-native";
import { fs } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { FideliioLogo } from "@/components/FideliioLogo";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  {
    key: "1",
    title: "onboarding.slide1.title",
    subtitle: "onboarding.slide1.subtitle",
    mainImage: "https://picsum.photos/seed/shopping42/800/360",
    grid: [
      {
        type: "image" as const,
        src: "https://picsum.photos/seed/loyalty10/400/200",
      },
      { type: "card" as const, icons: "💳", label: "Points" },
    ],
  },
  {
    key: "2",
    title: "onboarding.slide2.title",
    subtitle: "onboarding.slide2.subtitle",
    grid: [
      {
        type: "image" as const,
        src: "https://picsum.photos/seed/qrscan20/400/240",
      },
      { type: "card" as const, icons: "🪙", label: "QR" },
    ],
    bottomImage: "https://picsum.photos/seed/merchant55/800/200",
  },
  {
    key: "3",
    title: "onboarding.slide3.title",
    subtitle: "onboarding.slide3.subtitle",
    mainImage: "https://picsum.photos/seed/couch30/800/200",
    grid: [
      {
        type: "image" as const,
        src: "https://picsum.photos/seed/shop77/400/240",
      },
      { type: "card" as const, icons: "🛍️", label: "⭐⭐⭐" },
    ],
  },
];

export default function OnboardingSlides() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLast = currentIndex === SLIDES.length - 1;

  // ✅ Redirige vers login universel (plus vers /onboarding/role)
  function handleNext() {
    if (isLast) {
      router.replace("/auth/login");
    } else {
      const next = currentIndex + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  }

  function handleSkip() {
    router.replace("/auth/login");
  }

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  function renderSlide({ item }: ListRenderItemInfo<(typeof SLIDES)[0]>) {
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <LinearGradient
          colors={[colors.deepBlue, "#2a2a8e"]}
          style={styles.slideTop}
        >
          <FideliioLogo size={38} style={{ marginBottom: 10 }} />
          <Text style={[styles.slideTitle, { fontFamily: "Inter_700Bold" }]}>
            {t(item.title as any)}
          </Text>
          <Text
            style={[styles.slideSubtitle, { fontFamily: "Inter_400Regular" }]}
          >
            {t(item.subtitle as any)}
          </Text>
        </LinearGradient>
        <View style={styles.slideCard}>
          {item.mainImage && (
            <Image
              source={{ uri: item.mainImage }}
              style={styles.fullWidthImg}
              resizeMode="cover"
            />
          )}
          <View style={styles.twoCards}>
            {item.grid.map((g, i) =>
              g.type === "image" ? (
                <Image
                  key={i}
                  source={{ uri: g.src }}
                  style={styles.halfImg}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  key={i}
                  colors={
                    i === 0
                      ? [colors.coral, colors.orange]
                      : [colors.blue, colors.teal]
                  }
                  style={styles.illustCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.illustIcon}>{g.icons}</Text>
                  <Text style={styles.illustLabel}>{g.label}</Text>
                </LinearGradient>
              ),
            )}
          </View>
          {item.bottomImage && (
            <Image
              source={{ uri: item.bottomImage }}
              style={styles.fullWidthImg}
              resizeMode="cover"
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#fff" }]}>
      <View
        style={[
          styles.progress,
          { paddingTop: Platform.OS === "web" ? 67 : 52 },
        ]}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                flex: 1,
                height: i === currentIndex ? 4 : 3,
                borderRadius: 99,
                backgroundColor: i === currentIndex ? colors.coral : "#E5E7EB",
              },
            ]}
          />
        ))}
      </View>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        style={{ flex: 1 }}
      />
      <View
        style={[
          styles.buttons,
          { paddingBottom: Platform.OS === "web" ? 34 : 24 },
        ]}
      >
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipBtn}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.skipText,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {t("onboarding.skip")}
          </Text>
        </TouchableOpacity>
        {isLast ? (
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={[colors.green, "#00A87A"]}
              style={styles.nextBtnFull}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.nextText, { fontFamily: "Inter_700Bold" }]}>
                {t("onboarding.start")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.coral, colors.orange]}
              style={styles.nextBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text
                style={[styles.nextText, { fontFamily: "Inter_600SemiBold" }]}
              >
                {t("onboarding.next")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  progress: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  dot: {},
  slide: { flex: 1 },
  slideTop: {
    paddingTop: 18,
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: "center",
    gap: 8,
  },
  slideTitle: { color: "#fff", fontSize: fs(22), textAlign: "center" },
  slideSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: fs(14),
    textAlign: "center",
    lineHeight: 20,
  },
  slideCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
    padding: 14,
    gap: 10,
  },
  fullWidthImg: { width: "100%", height: 150, borderRadius: 16 },
  twoCards: { flexDirection: "row", gap: 10, flex: 1 },
  halfImg: { flex: 1, height: "100%", minHeight: 100, borderRadius: 16 },
  illustCard: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    minHeight: 100,
  },
  illustIcon: { fontSize: fs(26) },
  illustLabel: { color: "#fff", fontSize: fs(12), fontWeight: "bold" },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 14,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  skipBtn: { paddingHorizontal: 4, paddingVertical: 14 },
  skipText: { fontSize: fs(15) },
  nextBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 99 },
  nextBtnFull: { paddingVertical: 16, borderRadius: 99, alignItems: "center" },
  nextText: { color: "#fff", fontSize: fs(16) },
});
