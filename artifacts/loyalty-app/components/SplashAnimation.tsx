import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { iconSize } from "@/utils/responsive";

const { width: W } = Dimensions.get("window");

const INNER_RADIUS = 90;
const OUTER_RADIUS = 145;

const INNER_ICONS: { lib: "feather" | "mci"; name: string }[] = [
  { lib: "feather", name: "gift" },
  { lib: "mci", name: "qrcode-scan" },
  { lib: "feather", name: "star" },
  { lib: "mci", name: "percent" },
  { lib: "feather", name: "shopping-bag" },
];

const OUTER_ICONS: { lib: "feather" | "mci"; name: string }[] = [
  { lib: "mci", name: "cash-multiple" },
  { lib: "feather", name: "award" },
  { lib: "mci", name: "puzzle-outline" },
  { lib: "feather", name: "credit-card" },
  { lib: "mci", name: "tag-outline" },
  { lib: "feather", name: "wifi" },
];

function RingIcon({
  icon,
  index,
  count,
  radius,
  rotation,
  isClockwise,
}: {
  icon: { lib: "feather" | "mci"; name: string };
  index: number;
  count: number;
  radius: number;
  rotation: Animated.SharedValue<number>;
  isClockwise: boolean;
}) {
  const animStyle = useAnimatedStyle(() => {
    const base = (2 * Math.PI * index) / count - Math.PI / 2;
    const angle = base + rotation.value;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const counterRot = isClockwise ? -rotation.value : rotation.value;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${counterRot}rad` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.iconWrapper, animStyle]}>
      {icon.lib === "feather" ? (
        <Feather name={icon.name as any} size={iconSize(20)} color="rgba(255,255,255,0.75)" />
      ) : (
        <MaterialCommunityIcons name={icon.name as any} size={iconSize(20)} color="rgba(255,255,255,0.75)" />
      )}
    </Animated.View>
  );
}

export function SplashAnimation() {
  const innerRot = useSharedValue(0);
  const outerRot = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Inner ring clockwise: full loop 12s
    innerRot.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: 12000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Outer ring counter-clockwise: full loop 18s
    outerRot.value = withRepeat(
      withTiming(-2 * Math.PI, {
        duration: 18000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Card pulse
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const maxSize = Math.min(W * 0.85, 380);
  const ringSize = Math.max(OUTER_RADIUS * 2 + 80, maxSize);

  return (
    <View style={[styles.container, { width: ringSize, height: ringSize }]}>
      {/* Outer ring icons */}
      <View style={styles.ringContainer}>
        {OUTER_ICONS.map((icon, i) => (
          <RingIcon
            key={`outer-${i}`}
            icon={icon}
            index={i}
            count={OUTER_ICONS.length}
            radius={OUTER_RADIUS}
            rotation={outerRot}
            isClockwise={false}
          />
        ))}
      </View>

      {/* Inner ring icons */}
      <View style={styles.ringContainer}>
        {INNER_ICONS.map((icon, i) => (
          <RingIcon
            key={`inner-${i}`}
            icon={icon}
            index={i}
            count={INNER_ICONS.length}
            radius={INNER_RADIUS}
            rotation={innerRot}
            isClockwise={true}
          />
        ))}
      </View>

      {/* Center F card */}
      <Animated.View style={[styles.cardWrap, cardStyle]}>
        <LinearGradient
          colors={["#1a1a6e", "#C85A17"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Text style={styles.fLetter}>F</Text>
          <View style={styles.goldDot} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    position: "absolute",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  cardWrap: {
    shadowColor: "#C85A17",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  card: {
    width: 90,
    height: 90,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  fLetter: {
    color: "#fff",
    fontSize: iconSize(64),
    fontFamily: "Inter_700Bold",
    lineHeight: iconSize(72),
  },
  goldDot: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F9A602",
  },
});
