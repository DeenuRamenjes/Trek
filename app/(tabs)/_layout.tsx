import { Tabs } from 'expo-router';
import { useReduceMotion } from '../../src/ui/motion';
import { TabBar } from '../../src/ui/navigation/TabBar';

export default function TabsLayout() {
  const reduce = useReduceMotion();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'fade' }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="goals" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
