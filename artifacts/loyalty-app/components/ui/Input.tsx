import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

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

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.container,
          {
            borderRadius: colors.radius,
            borderColor: error ? colors.destructive : focused ? colors.primary : colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        {leftIcon && (
          <Feather name={leftIcon} size={18} color={colors.mutedForeground} style={styles.leftIcon} />
        )}
        <TextInput
          {...props}
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: "Inter_400Regular",
              flex: 1,
            },
          ]}
          placeholderTextColor={colors.mutedForeground}
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
            <Feather name={rightIcon} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
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
    fontSize: 13,
    marginBottom: 6,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    fontSize: 15,
    paddingVertical: 14,
  },
  rightIcon: {
    marginLeft: 10,
    padding: 2,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});
