import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { FideliioLogo } from "@/components/FideliioLogo";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_COUNT = 3;

const SLIDE_IMAGES = {
  slide1_main: "https://picsum.photos/seed/shopping42/800/360",
  slide1_card: "https://picsum.photos/seed/loyalty10/400/200",
  slide2_left: "https://picsum.photos/seed/qrscan20/400/240",
  slide2_bottom: "https://picsum.photos/seed/merchant55/800/200",
  slide3_top: "https://picsum.photos/seed/couch30/800/200",
  slide3_left: "https://picsum.photos/seed/shop77/400/240",
};

export default function OnboardingSlides() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  function goToSlide(index: number) {
    const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, index));
    translateX.value = withSpring(-clamped * SCREEN_WIDTH, {
      damping: 20,
      stiffness: 150,
    });
    setCurrentSlide(clamped);
  }

  function handleNext() {
    if (currentSlide < SLIDE_COUNT - 1) {
      goToSlide(currentSlide + 1);
    } else {
      router.push("/onboarding/role");
    }
  }

  function handleSkip() {
    router.push("/onboarding/role");
  }

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const newVal = startX.value + e.translationX;
      const min = -(SLIDE_COUNT - 1) * SCREEN_WIDTH;
      translateX.value = Math.max(min, Math.min(0, newVal));
    })
    .onEnd((e) => {
      const velocity = e.velocityX;
      const offset = e.translationX;
      let targetSlide = currentSlide;
      if (offset < -50 || velocity < -300) {
        targetSlide = Math.min(SLIDE_COUNT - 1, currentSlide + 1);
      } else if (offset > 50 || velocity > 300) {
        targetSlide = Math.max(0, currentSlide - 1);
      }
      runOnJS(goToSlide)(targetSlide);
    });

  const animatedSlider = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const isLast = currentSlide === SLIDE_COUNT - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Progress bar */}
      <View style={[styles.progressBar, { paddingTop: Platform.OS === "web" ? 67 : 52 }]}>
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              {
                flex: 1,
                backgroundColor: i === currentSlide ? colors.coral : "#E5E7EB",
                height: i === currentSlide ? 4 : 3,
                borderRadius: 99,
              },
            ]}
          />
        ))}
      </View>

      {/* Slides */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.slidesTrack, animatedSlider]}>
          {/* Slide 1 */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <LinearGradient
              colors={[colors.deepBlue, "#2a2a8e"]}
              style={styles.slideTop}
            >
              <FideliioLogo size={40} style={{ marginBottom: 12 }} />
              <Text style={[styles.slideTitle, { fontFamily: "Inter_700Bold" }]}>
                {t("onboarding.slide1.title")}
              </Text>
              <Text style={[styles.slideSubtitle, { fontFamily: "Inter_400Regular" }]}>
                {t("onboarding.slide1.subtitle")}
              </Text>
            </LinearGradient>
            <View style={styles.slideCard}>
              <Image
                source={{ uri: SLIDE_IMAGES.slide1_main }}
                style={styles.fullWidthImg}
                resizeMode="cover"
              />
              <View style={styles.twoCards}>
                <LinearGradient
                  colors={[colors.coral, colors.orange]}
                  style={styles.illustrationCard}
                >
                  <Text style={styles.illustrationIcon}>💳</Text>
                  <Text style={styles.illustrationText}>Points</Text>
                </LinearGradient>
                <LinearGradient
                  colors={[colors.coral, colors.orange]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.illustrationCard}
                >
                  <FideliioLogo size={36} />
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* Slide 2 */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <LinearGradient
              colors={[colors.deepBlue, "#2a2a8e"]}
              style={styles.slideTop}
            >
              <FideliioLogo size={40} style={{ marginBottom: 12 }} />
              <Text style={[styles.slideTitle, { fontFamily: "Inter_700Bold" }]}>
                {t("onboarding.slide2.title")}
              </Text>
              <Text style={[styles.slideSubtitle, { fontFamily: "Inter_400Regular" }]}>
                {t("onboarding.slide2.subtitle")}
              </Text>
            </LinearGradient>
            <View style={styles.slideCard}>
              <View style={styles.twoCards}>
                <Image
                  source={{ uri: SLIDE_IMAGES.slide2_left }}
                  style={[styles.halfImg, { flex: 1 }]}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[colors.blue, colors.teal]}
                  style={styles.illustrationCard}
                >
                  <Text style={styles.illustrationIcon}>🪙</Text>
                  <Text style={styles.illustrationText}>QR</Text>
                </LinearGradient>
              </View>
              <Image
                source={{ uri: SLIDE_IMAGES.slide2_bottom }}
                style={styles.fullWidthImg}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Slide 3 */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <LinearGradient
              colors={[colors.deepBlue, "#2a2a8e"]}
              style={styles.slideTop}
            >
              <FideliioLogo size={40} style={{ marginBottom: 12 }} />
              <Text style={[styles.slideTitle, { fontFamily: "Inter_700Bold" }]}>
                {t("onboarding.slide3.title")}
              </Text>
              <Text style={[styles.slideSubtitle, { fontFamily: "Inter_400Regular" }]}>
                {t("onboarding.slide3.subtitle")}
              </Text>
            </LinearGradient>
            <View style={styles.slideCard}>
              <Image
                source={{ uri: SLIDE_IMAGES.slide3_top }}
                style={styles.fullWidthImg}
                resizeMode="cover"
              />
              <View style={styles.twoCards}>
                <Image
                  source={{ uri: SLIDE_IMAGES.slide3_left }}
                  style={[styles.halfImg, { flex: 1 }]}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[colors.blue, colors.purple600]}
                  style={styles.illustrationCard}
                >
                  <Text style={styles.illustrationIcon}>🛍️</Text>
                  <Text style={styles.illustrationText}>⭐⭐⭐</Text>
                </LinearGradient>
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Bottom buttons */}
      <View style={[styles.buttons, { paddingBottom: Platform.OS === "web" ? 34 : 24 }]}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {t("onboarding.skip")}
          </Text>
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity onPress={handleNext} activeOpacity={0.85} style={{ flex: 1 }}>
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
              <Text style={[styles.nextText, { fontFamily: "Inter_600SemiBold" }]}>
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
  progressBar: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingBottom: 12,
    zIndex: 10,
  },
  progressDot: {},
  slidesTrack: {
    flex: 1,
    flexDirection: "row",
  },
  slide: {
    flex: 1,
  },
  slideTop: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: "center",
    gap: 8,
  },
  slideTitle: {
    color: "#fff",
    fontSize: 22,
    textAlign: "center",
  },
  slideSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  slideCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
    padding: 16,
    gap: 10,
  },
  fullWidthImg: {
    width: "100%",
    height: 160,
    borderRadius: 16,
  },
  twoCards: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
  },
  halfImg: {
    height: "100%",
    minHeight: 100,
    borderRadius: 16,
  },
  illustrationCard: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    minHeight: 100,
  },
  illustrationIcon: {
    fontSize: 28,
  },
  illustrationText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  skipBtn: {
    paddingHorizontal: 4,
    paddingVertical: 14,
  },
  skipText: {
    fontSize: 15,
  },
  nextBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 99,
  },
  nextBtnFull: {
    paddingVertical: 16,
    borderRadius: 99,
    alignItems: "center",
  },
  nextText: {
    color: "#fff",
    fontSize: 16,
  },
});
