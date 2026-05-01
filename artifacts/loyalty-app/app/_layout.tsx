import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import {
  Button,
  InputAccessoryView,
  Keyboard,
  Platform,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { KEYBOARD_TOOLBAR_ID } from "@/constants/keyboard";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { DataProvider } from "@/context/DataContext";
import { GlobalToast } from "@/components/GlobalToast";

// ✅ Fix Android : charger explicitement la font des icônes Feather
import { Feather } from "@expo/vector-icons";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/language" />
        <Stack.Screen name="onboarding/slides" />
        <Stack.Screen name="onboarding/role" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot" />
        <Stack.Screen name="auth/role" />
        <Stack.Screen name="auth/merchant-setup" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(merchant)" />
      </Stack>
      <GlobalToast />
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={KEYBOARD_TOOLBAR_ID}>
          <View
            style={{
              backgroundColor: "#F8F8F8",
              borderTopWidth: 0.5,
              borderTopColor: "#E0E0E0",
              paddingHorizontal: 16,
              paddingVertical: 6,
              alignItems: "flex-end",
            }}
          >
            <Button title="Fermer" onPress={Keyboard.dismiss} />
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // ✅ Charge la font Feather explicitement — évite les carrés sur Android.
    // Sur iOS, expo-vector-icons la charge automatiquement via le bundle natif,
    // mais Android en a besoin dans useFonts pour garantir le rendu correct.
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AppProvider>
              <DataProvider>
                <ErrorBoundary>
                  <RootLayoutNav />
                </ErrorBoundary>
              </DataProvider>
            </AppProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
