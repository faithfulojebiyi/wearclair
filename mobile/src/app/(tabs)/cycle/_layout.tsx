import { Stack } from 'expo-router';

import { c } from '@/ui/theme/theme';

// the Cycle tab is its own stack: the calendar hub (index) pushes the Timeline
// screen and presents Edit period / Track / More parameters as modals.
export default function CycleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="timeline" />
      <Stack.Screen name="edit-period" options={{ presentation: 'modal' }} />
      <Stack.Screen name="track" options={{ presentation: 'modal' }} />
      <Stack.Screen name="parameters" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
