import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Button, SafeAreaView, Text, View } from "react-native";

import { resolveNotificationDeepLink } from "@zynd/shared/notifications";

import { markNotificationRead, setAccessToken } from "@/services/api";
import {
  attachNotificationListeners,
  registerMobilePushDevice,
  resolvePushDeepLink,
  revokeMobilePushDevice,
} from "@/services/push-notifications";

type RootStackParamList = {
  Home: undefined;
  Notifications: undefined;
  Kyc: undefined;
  Referral: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>{title}</Text>
      <Text style={{ marginTop: 8, textAlign: "center", color: "#64748b" }}>
        Wire this screen to the shared Zynd mobile auth and dashboard flows.
      </Text>
    </SafeAreaView>
  );
}

export default function App() {
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState("Push not registered");

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void registerMobilePushDevice(storage)
      .then((result) => {
        setPushStatus(result ? "Push device registered" : "Push registration skipped");
      })
      .catch(() => {
        setPushStatus("Push registration failed");
      });
  }, [accessToken]);

  useEffect(() => {
    return attachNotificationListeners({
      onResponse: (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const notificationId = typeof data.notification_id === "string" ? data.notification_id : null;
        if (notificationId) {
          void markNotificationRead(notificationId);
        }
        resolvePushDeepLink(data);
      },
    });
  }, []);

  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({
      prefixes: ["zynd://"],
      config: {
        screens: {
          Home: "dashboard",
          Notifications: "dashboard/notifications",
          Kyc: "dashboard/kyc",
          Referral: "dashboard/referral",
          Settings: "dashboard/settings",
        },
      },
    }),
    [],
  );

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="auto" />
      <Stack.Navigator>
        <Stack.Screen name="Home" options={{ title: "Zynd Mobile" }}>
          {() => (
            <SafeAreaView style={{ flex: 1, padding: 24, gap: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: "700" }}>Zynd Mobile</Text>
              <Text style={{ color: "#64748b" }}>
                Phase 3 scaffold: FCM token registration, push listeners, and shared deep-link routing.
              </Text>
              <Text>{pushStatus}</Text>
              <Button
                title={accessToken ? "Simulate logout" : "Simulate login"}
                onPress={() => {
                  if (accessToken) {
                    void revokeMobilePushDevice(storage).finally(() => {
                      setTokenState(null);
                      setPushStatus("Push not registered");
                    });
                    return;
                  }
                  setTokenState("dev-access-token");
                }}
              />
              <View style={{ gap: 8 }}>
                <Text style={{ fontWeight: "600" }}>Deep link preview</Text>
                <Text>
                  {JSON.stringify(
                    resolveNotificationDeepLink({
                      notification_type: "kyc.completed",
                      category: "kyc",
                    }),
                  )}
                </Text>
              </View>
            </SafeAreaView>
          )}
        </Stack.Screen>
        <Stack.Screen name="Notifications" children={() => <PlaceholderScreen title="Notifications" />} />
        <Stack.Screen name="Kyc" children={() => <PlaceholderScreen title="KYC" />} />
        <Stack.Screen name="Referral" children={() => <PlaceholderScreen title="Referral" />} />
        <Stack.Screen name="Settings" children={() => <PlaceholderScreen title="Settings" />} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
