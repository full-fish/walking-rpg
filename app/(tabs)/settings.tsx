import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { expToNext } from '@/game/formulas';
import { usePlayer } from '@/stores/usePlayer';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

export default function Settings() {
  const save = usePlayer((s) => s.save);
  const addGold = usePlayer((s) => s.addGold);
  const addWp = usePlayer((s) => s.addWp);
  const settle = usePlayer((s) => s.settle);
  const grantGearSet = usePlayer((s) => s.grantGearSet);
  const grantAllSprites = usePlayer((s) => s.grantAllSprites);
  const grantWeapons = usePlayer((s) => s.grantWeapons);
  const setBagCapacity = usePlayer((s) => s.setBagCapacity);
  const grantMaterials = usePlayer((s) => s.grantMaterials);
  const grantDex = usePlayer((s) => s.grantDex);
  const reset = usePlayer((s) => s.reset);
  const arrowArt = usePlayer((s) => s.arrowArt);
  const setArrowArt = usePlayer((s) => s.setArrowArt);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text size="xl">설정</Text>

      {/* 저장 동작 확인용. 실제 설정 항목은 나중에 이 자리를 대체한다. */}
      <Panel title="세이브">
        <Text>골드 {save.player.gold}</Text>
        <Text>WP {save.wp.current}</Text>
        <Text size="sm" dim>
          세이브 버전 {save.version}
        </Text>
        <View style={styles.row}>
          <Button label="골드 +100" tone="gold" onPress={() => addGold(100)} />
          <Button label="WP +1000" tone="gold" onPress={() => addWp(1000)} />
          {/* 슬라임만으로 레벨업까지 42마리라 실기기 확인이 안 된다. 실제 정산 경로를 그대로 탄다. */}
          <Button
            label="레벨 +1"
            onPress={() =>
              settle('win', save.player.hp, {
                exp: expToNext(save.player.level) - save.player.exp,
                gold: 0,
              })
            }
          />
          <Button label="장비 한 벌" onPress={grantGearSet} />
          <Button label="초기화" onPress={reset} />
        </View>
        {/* 아이콘 전수 확인용 — 그림 70종이 가방에 다 들어가게 칸부터 늘린다 */}
        <View style={styles.row}>
          <Button label="골드 +1000" tone="gold" onPress={() => addGold(1_000)} />
          <Button label="WP +10000" tone="gold" onPress={() => addWp(10_000)} />
        </View>
        <View style={styles.row}>
          <Button label="가방 300칸" onPress={() => setBagCapacity(300)} />
          <Button label="그림별 장비 1개씩" onPress={grantAllSprites} />
        </View>
        {/* 반지·강화 +6 확인용 (T17_7) — 6마리 판을 몇십 번 돌아야 모이는 걸 한 번에 준다 */}
        <View style={styles.row}>
          <Button label="소재 전부 +3" onPress={() => grantMaterials(3)} />
          {/* 도감 단계 확인용 (T19) — 100마리는 몇 주 걸린다 */}
          <Button label="도감 +10 (지금 지역)" onPress={() => grantDex(10)} />
        </View>
        {/* 무기 계열 확인용 (T18) — 다섯 계열의 손(단검 두 자루)과 그 지역 기본 화살 300발 · 특수 여덟 종 30발씩 (T18_1) */}
        <View style={styles.row}>
          <Button label="무기 계열 한 벌씩 + 화살" onPress={grantWeapons} />
        </View>
        {/* 화살 연출 비교 (T18_1) — 코드로 그린 선이냐 화살 그림이냐. 그림이 없는 화살은 선으로 난다 */}
        <View style={styles.row}>
          <Button
            label="화살 연출: 코드"
            tone={arrowArt === 'code' ? 'gold' : 'normal'}
            onPress={() => setArrowArt('code')}
          />
          <Button
            label="화살 연출: 그림"
            tone={arrowArt === 'sprite' ? 'gold' : 'normal'}
            onPress={() => setArrowArt('sprite')}
          />
        </View>
        <Text size="sm" dim>
          앱을 완전히 끄고 다시 켜도 값이 남아 있어야 합니다.
        </Text>
        <Text size="sm" dim>
          [장비 한 벌]은 지금 레벨의 common 풀세트를 공짜로 줍니다.
        </Text>
        <Text size="sm" dim>
          소재는 이제 6마리 판을 완주하면 떨어집니다 (행운을 찍으면 그 아래에서도 가끔).
        </Text>
      </Panel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
});
