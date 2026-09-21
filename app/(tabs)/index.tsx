import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { regionById } from '@/content';
import { statsOf } from '@/game/progression';
import { useSteps } from '@/health/useSteps';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** HUD 한 칸. 새 공용 컴포넌트를 만들 만큼은 아니라 이 화면 안에 둔다. */
function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text size="sm" dim>
        {label}
      </Text>
      <Text color={color}>{value.toLocaleString()}</Text>
    </View>
  );
}

/** T16이 지역·사냥터 선택을 붙이기 전까지는 지역 1의 첫 사냥터를 보여준다. */
const REGION = regionById(1);
const FIELD = REGION.fields[0];

/** 모험 탭. 상단 HUD까지 (사냥터 진행은 S2~). */
export default function Adventure() {
  const router = useRouter();
  const steps = useSteps();
  const save = usePlayer((s) => s.save);
  const grantFromSteps = usePlayer((s) => s.grantFromSteps);
  const regen = usePlayer((s) => s.regen);
  const stats = statsOf(save);

  // 걸음이 갱신될 때마다(=60초 폴링/센서) 지급과 HP 회복을 함께 반영한다.
  // 둘 다 받을 게 없으면 아무것도 저장하지 않으므로 그냥 매번 불러도 된다.
  useEffect(() => {
    grantFromSteps(steps.byDate);
    regen();
  }, [steps.byDate, grantFromSteps, regen]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text size="xl">walkingRPG</Text>

      <Panel title={`Lv ${save.player.level}`}>
        <View style={styles.hud}>
          <Stat label="오늘 걸음" value={steps.today} />
          <Stat label="WP" value={save.wp.current} color={colors.wp} />
          <Stat label="골드" value={save.player.gold} color={colors.gold} />
        </View>
        <Bar label="HP" value={save.player.hp} max={stats.maxHp} color={colors.hp} />
        <View style={styles.row}>
          <Button label="새로고침" onPress={steps.refresh} />
          {steps.status !== 'connected' && steps.status !== 'unavailable' && (
            <Button label="Health Connect 연결" onPress={steps.connect} />
          )}
        </View>
        {steps.status !== 'connected' && (
          <Text size="sm" dim>
            {steps.status === 'unavailable'
              ? '이 기기에서 걸음을 셀 수 없습니다.'
              : 'Health Connect가 연결되지 않아 앱을 켠 동안의 걸음만 셉니다. 연결하면 워치 걸음과 지난 3일치도 반영됩니다.'}
          </Text>
        )}
      </Panel>

      <Panel title={REGION.name}>
        <Text>{FIELD.name}</Text>
        <View style={styles.row}>
          {/* T16이 사냥터 한 판(2~6마리)을 붙이면 /field로 바뀐다. 지금은 1마리 전투로 직행. */}
          <Button
            label="사냥 시작"
            tone="gold"
            disabled={save.player.hp <= 0}
            onPress={() => router.push('/battle')}
          />
          <Button label="이동" />
        </View>
        {save.statPoints.unspent > 0 && (
          <Text size="sm" color={colors.gold}>
            쓰지 않은 스탯 포인트 {save.statPoints.unspent}점 — 캐릭터 탭에서 올리세요
          </Text>
        )}
      </Panel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: space.xs },
});
