import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import RealtimeNotificationBridge from "@/components/notifications/RealtimeNotificationBridge";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { hydrateServerApiBaseUrlOverride } from "@/lib/server-api";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void hydrateServerApiBaseUrlOverride();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <RealtimeNotificationBridge />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
