import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { KEYBOARD_TOOLBAR_ID } from "@/constants/keyboard";

// ✅ Import responsive — uniquement pour Android
import { fs, sp, iconSize } from "@/utils/responsive";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  ...props
}: InputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  // ✅ Sur Android, on force une taille explicite en number pour les icônes.
  // Sur iOS, on garde la valeur fixe originale (18) — aucun changement visuel.
  const ICON_SIZE = Platform.OS === "android" ? iconSize(18) : 18;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text
          allowFontScaling={false}
          style={[
            styles.label,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              // ✅ fontSize responsive sur Android uniquement
              fontSize: Platform.OS === "android" ? fs(13) : 13,
            },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.container,
          {
            borderRadius: colors.radius,
            borderColor: error
              ? colors.destructive
              : focused
                ? colors.primary
                : colors.border,
            backgroundColor: colors.card,
            // ✅ Padding responsive Android uniquement
            paddingHorizontal: Platform.OS === "android" ? sp(14) : 14,
          },
        ]}
      >
        {leftIcon && (
          <Feather
            name={leftIcon}
            // ✅ size doit être un number explicite — Android échoue silencieusement
            // si la valeur est undefined, NaN ou string
            size={ICON_SIZE}
            color={colors.mutedForeground}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          {...props}
          inputAccessoryViewID={
            Platform.OS === "ios" ? KEYBOARD_TOOLBAR_ID : undefined
          }
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: "Inter_400Regular",
              flex: 1,
              // ✅ fontSize responsive Android uniquement
              fontSize: Platform.OS === "android" ? fs(15) : 15,
              paddingVertical: Platform.OS === "android" ? sp(12) : 14,
            },
          ]}
          placeholderTextColor={colors.mutedForeground}
          // ✅ Empêche Android de scaler les fontes selon les préférences système
          allowFontScaling={false}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />

        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Feather
              name={rightIcon}
              size={ICON_SIZE}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text
          allowFontScaling={false}
          style={[
            styles.error,
            {
              color: colors.destructive,
              fontFamily: "Inter_400Regular",
              fontSize: Platform.OS === "android" ? fs(12) : 12,
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    // fontSize défini inline (Android/iOS split)
    marginBottom: 6,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    // paddingHorizontal défini inline
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    // fontSize et paddingVertical définis inline
  },
  rightIcon: {
    marginLeft: 10,
    padding: 2,
  },
  error: {
    // fontSize défini inline
    marginTop: 4,
  },
});
