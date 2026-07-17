import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useSession } from '../../lib/auth-client';
import { c } from '../../lib/theme';
import { getToken, setToken } from '../../lib/token';

export default function TabsLayout() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const token = session?.session?.token;

  // web: persist the session token so the Orval axios client can send it as a Bearer
  // header (no-op on native, where the cookie header drives auth). If any query
  // already failed before the token was stored (child effects run before this one),
  // invalidate so they refetch authenticated.
  useEffect(() => {
    if (!token) {
      return;
    }

    const hadToken = getToken();
    setToken(token);

    if (!hadToken) {
      queryClient.invalidateQueries();
    }
  }, [token, queryClient]);

  if (isPending) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: c.bg,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="sunny-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="trending-up-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="device"
        options={{
          title: 'Device',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="watch-outline" size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
