import { Redirect } from "expo-router";
import { useApp } from "@/context/AppContext";

export default function Index() {
  const { user, isOnboarded } = useApp();

  if (!isOnboarded) {
    return <Redirect href="/onboarding/language" />;
  }

  if (!user) {
    return <Redirect href="/auth/role" />;
  }

  if (user.role === "customer") {
    return <Redirect href="/(customer)/home" />;
  }

  return <Redirect href="/(merchant)/home" />;
}
