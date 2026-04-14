import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import i18n, { applyRTL } from "@/i18n";

export type Language = "fr" | "ar" | "en";
export type UserRole = "customer" | "merchant";

export interface User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  language: Language;
  businessName?: string;
  businessCategory?: string;
  pointsRate?: number;
  totalPoints?: number;
  logoUrl?: string;
}

interface AppContextType {
  user: User | null;
  language: Language;
  isRTL: boolean;
  isOnboarded: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "@loyalty_user",
  LANGUAGE: "@loyalty_language",
  ONBOARDED: "@loyalty_onboarded",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [language, setLanguageState] = useState<Language>("fr");
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isRTL = language === "ar";

  useEffect(() => {
    loadStoredData();
  }, []);

  async function loadStoredData() {
    try {
      const [storedUser, storedLang, storedOnboarded] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED),
      ]);

      if (storedLang) {
        const lang = storedLang as Language;
        setLanguageState(lang);
        i18n.changeLanguage(lang);
        applyRTL(lang);
      }

      if (storedUser) {
        setUserState(JSON.parse(storedUser));
      }

      if (storedOnboarded === "true") {
        setIsOnboarded(true);
      }
    } catch (e) {
      console.warn("Error loading stored data:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function setLanguage(lang: Language) {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
    applyRTL(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);

    if (user) {
      const updatedUser = { ...user, language: lang };
      setUserState(updatedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    }
  }

  function setUser(newUser: User | null) {
    setUserState(newUser);
    if (newUser) {
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    } else {
      AsyncStorage.removeItem(STORAGE_KEYS.USER);
    }
  }

  async function logout() {
    setUserState(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  }

  async function completeOnboarding() {
    setIsOnboarded(true);
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, "true");
  }

  if (isLoading) return null;

  return (
    <AppContext.Provider
      value={{
        user,
        language,
        isRTL,
        isOnboarded,
        setLanguage,
        setUser,
        logout,
        completeOnboarding,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
