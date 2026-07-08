import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#f5f5f7' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Reader Test' }} />
    </Stack>
  );
}
