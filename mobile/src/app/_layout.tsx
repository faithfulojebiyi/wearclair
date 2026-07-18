import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Provider as TinyBaseProvider } from 'tinybase/ui-react';

import { queryClient } from '@/api/query-client';
import { initPersistence, store } from '@/modules/band/local-store';
import { c } from '@/ui/theme/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  // load the persisted local vitals + start auto-save (best-effort; no-op on failure)
  useEffect(() => {
    void initPersistence();
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: c.bg,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <TinyBaseProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
          }}
        />
      </QueryClientProvider>
    </TinyBaseProvider>
  );
}
