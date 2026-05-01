/**
 * responsive.ts — Fideliio
 * Utilitaire de mise à l'échelle universel iOS / Android
 *
 * Basé sur un écran de référence 390×844 (iPhone 14)
 * S'adapte automatiquement à tous les appareils Android et iOS.
 */

import { Dimensions, Platform, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Écran de référence (iPhone 14)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// ─── Mise à l'échelle dimensionnelle ────────────────────────────────────────

/** Scale horizontal (largeur) */
export const scaleW = (size: number): number =>
  Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);

/** Scale vertical (hauteur) */
export const scaleH = (size: number): number =>
  Math.round((SCREEN_HEIGHT / BASE_HEIGHT) * size);

/** Scale modéré — idéal pour les polices (évite les extrêmes) */
export const scaleMod = (size: number, factor = 0.45): number => {
  const newSize = size + (scaleW(size) - size) * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// ─── Fontes ─────────────────────────────────────────────────────────────────

/**
 * fs(size) — fontSize responsive
 * Utilise allowFontScaling=false en parallèle pour éviter
 * que les réglages d'accessibilité Android cassent le layout.
 *
 * Exemple : fontSize: fs(16)
 */
export const fs = scaleMod;

// Échelle typographique prête à l'emploi
export const FontSize = {
  xs: fs(11),
  sm: fs(13),
  md: fs(15),
  base: fs(16),
  lg: fs(18),
  xl: fs(20),
  "2xl": fs(24),
  "3xl": fs(28),
  "4xl": fs(32),
  "5xl": fs(38),
} as const;

// ─── Icônes ──────────────────────────────────────────────────────────────────

/**
 * iconSize(size) — taille d'icône responsive
 * Moins agressive que scaleMod (factor 0.3) pour garder
 * des icônes cohérentes sur tous les écrans.
 *
 * Exemple : <Ionicons size={iconSize(24)} />
 */
export const iconSize = (size: number): number =>
  Math.round(size + (scaleW(size) - size) * 0.3);

// Tailles d'icônes standard
export const IconSize = {
  xs: iconSize(14),
  sm: iconSize(18),
  md: iconSize(22),
  lg: iconSize(26),
  xl: iconSize(32),
  "2xl": iconSize(40),
} as const;

// ─── Espacements ─────────────────────────────────────────────────────────────

/**
 * sp(size) — spacing responsive (padding, margin, gap, borderRadius)
 * Exemple : paddingHorizontal: sp(16)
 */
export const sp = scaleW;

export const Spacing = {
  xs: sp(4),
  sm: sp(8),
  md: sp(12),
  base: sp(16),
  lg: sp(20),
  xl: sp(24),
  "2xl": sp(32),
  "3xl": sp(40),
  "4xl": sp(48),
} as const;

// ─── Helpers plateforme ──────────────────────────────────────────────────────

/** Vrai pixel ratio de l'écran */
export const pixelRatio = PixelRatio.get();

/** Densité de l'écran — utile pour du debug */
export const screenInfo = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  pixelRatio,
  platform: Platform.OS,
  isAndroid: Platform.OS === "android",
  isIOS: Platform.OS === "ios",
};

// ─── Correctif Android fonts ─────────────────────────────────────────────────

/**
 * androidFontFix — à ajouter sur chaque <Text> ou dans un composant Text global.
 * Empêche Android de scaler les fontes selon les préférences système utilisateur,
 * ce qui casse souvent le layout sur les appareils avec grande taille de texte.
 *
 * Utilisation :
 *   <Text style={styles.label} {...androidFontFix}>Mon texte</Text>
 */
export const androidFontFix =
  Platform.OS === "android"
    ? { allowFontScaling: false }
    : { allowFontScaling: false }; // false sur les deux pour la cohérence
