import { Tabs } from 'expo-router';

import { border, colors, font, space } from '@/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.dim,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopWidth: border,
          borderTopColor: colors.edge,
          // height를 박으면 제스처 바 영역(safe area)이 사라져 라벨이 가려진다. 기본 높이를 쓴다.
          paddingTop: space.sm,
        },
        tabBarLabelStyle: { fontFamily: font.family, fontSize: font.md },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      {/* 플랜의 adventure.tsx — '/'가 바로 모험 탭이 되도록 index로 둔다 */}
      <Tabs.Screen name="index" options={{ title: '모험' }} />
      <Tabs.Screen name="character" options={{ title: '캐릭터' }} />
      <Tabs.Screen name="shop" options={{ title: '상점' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
