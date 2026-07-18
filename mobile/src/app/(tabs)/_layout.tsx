import {
  Activity,
  CalendarDays,
  House,
  Sparkles,
  User,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Redirect, Tabs, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useSession } from '@/modules/auth/auth-client';
import { useDevices } from '@/modules/band/queries/use-devices';
import { c } from '@/ui/theme/theme';
import { getToken, setToken } from '@/modules/auth/token';
import { useAccountIsolation } from '@/modules/band/use-account-isolation';
import { useSyncUpdates } from '@/modules/band/use-sync-updates';
import { useVitalsSync } from '@/modules/band/use-vitals-sync';

export default function TabsLayout() {
  const { data: session, isPending, refetch } = useSession();
  const queryClient = useQueryClient();
  const token = session?.session?.token;

  // hide the floating tab bar on the pushed Timeline screen so the user must go back
  // to the calendar before switching tabs (useSegments re-renders on navigation, so
  // the style actually updates — unlike reading the nested route in screen options).
  const segments = useSegments() as string[];
  const hideTabBar = segments.includes('timeline');

  // Force a fresh session fetch when this layout mounts, and don't decide anything
  // until it settles. useSession is a global nanostore atom: after sign-in navigates
  // here it can still hold a stale `null` (not pending), so a plain `!session` guard
  // bounces straight back to /sign-in — the "log in twice" bug. refetch() is the
  // atom's own fetcher, so awaiting it hydrates useSession itself, not just a copy.
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.resolve(refetch?.()).finally(() => {
      if (active) {
        setResolved(true);
      }
    });

    return () => {
      active = false;
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the device to sync the local vitals queue against (first paired band).
  const devices = useDevices(Boolean(session));

  // account isolation BEFORE the sync engine: claim/wipe the local vitals store for
  // the signed-in user, and stop the band stream when the session dies without an
  // explicit sign-out (expiry/revocation).
  useAccountIsolation(session?.user?.id, resolved && !isPending);

  // background vitals sync engine — drains the local queue to the backend app-wide.
  useVitalsSync(devices.data?.devices[0]?.id, session?.user?.id);

  // realtime "derivation finished" push — refreshes insights/cycle/biomarkers the
  // moment the worker marks a synced batch PROCESSED.
  useSyncUpdates(Boolean(session) && resolved);

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

  if (isPending || !resolved) {
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
        tabBarShowLabel: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // floating glass pill — detached from the edges, icons only. The BlurView
        // background is what makes it glassmorphic (backdrop-filter on web).
        tabBarStyle: styles.glassTabBar,
        tabBarItemStyle: { paddingTop: 12 },
        tabBarBackground: () => (
          <BlurView
            intensity={28}
            style={StyleSheet.absoluteFill}
            tint="light"
          >
            <View style={styles.glassOverlay} />
          </BlurView>
        ),
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <House color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="cycle"
        options={{
          title: 'Cycle',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size - 2} strokeWidth={2.2} />
          ),
          tabBarStyle: hideTabBar ? styles.hiddenTabBar : styles.glassTabBar,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Sparkles color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="perform"
        options={{
          title: 'Perform',
          tabBarIcon: ({ color, size }) => (
            <Activity color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glassOverlay: {
    backgroundColor: 'rgba(255, 252, 251, 0.55)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  glassTabBar: {
    backgroundColor: 'transparent',
    borderRadius: 32,
    borderTopWidth: 0,
    bottom: 28,
    // cross-platform outer shadow (new-arch boxShadow) — the legacy iOS shadow*
    // props never rendered here: they trace the view's own alpha, which is
    // transparent + overflow-clipped on this glass pill.
    boxShadow: '0px 10px 24px rgba(42, 20, 8, 0.15)',
    height: 64,
    marginHorizontal: 16,
    overflow: 'hidden',
    position: 'absolute',
  },
  hiddenTabBar: { display: 'none' },
});
