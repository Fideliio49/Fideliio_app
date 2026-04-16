import colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

/**
 * Returns the design tokens for the current color theme.
 * Theme is controlled by AppContext (user preference, persisted in AsyncStorage).
 * The `primary` token is overridden by the user's chosen accent color.
 */
export function useColors() {
  const { colorTheme, accentColor } = useApp();
  const palette =
    colorTheme === "dark" && "dark" in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;

  return {
    ...palette,
    radius: colors.radius,
    primary: accentColor || palette.primary,
    tint: accentColor || palette.tint,
  };
}
