import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";

import en from "./translations/en";
import fr from "./translations/fr";
import ar from "./translations/ar";

export const RTL_LANGUAGE = "ar";

export function applyRTL(lang: string) {
  const isRTL = lang === RTL_LANGUAGE;
  I18nManager.forceRTL(isRTL);
}

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: "fr",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
