import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { regionById, type Field } from '@/content';
import { WP_COST } from '@/game/formulas';
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

/** 모험 탭. 상단 HUD까지 (사냥터 진행은 S2~). */
export default function Adventure() {
  const router = useRouter();
  const steps = useSteps();
  const save = usePlayer((s) => s.save);
  const grantFromSteps = usePlayer((s) => s.grantFromSteps);
  const regen = usePlayer((s) => s.regen);
  const enter = usePlayer((s) => s.enter);
  const stats = statsOf(save);
  const region = regionById(save.regionProgress.current);
  const entryCost = WP_COST.fieldEntry(region.id);

  // 걸음이 갱신될 때마다(=60초 폴링/센서) 지급과 HP 회복을 함께 반영한다.
  // 둘 다 받을 게 없으면 아무것도 저장하지 않으므로 그냥 매번 불러도 된다.
  useEffect(() => {
    grantFromSteps(steps.byDate);
    regen();
  }, [steps.byDate, grantFromSteps, regen]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* 사냥터가 7곳이라(T17_4) 한 화면에 안 들어간다 */}
      <ScrollView contentContainerStyle={styles.body}>
        <Text size="xl">walkingRPG</Text>

        <Panel title={`Lv ${save.player.level}`}>
          <View style={styles.hud}>
            <Stat label="오늘 걸음" value={steps.today} />
            <Stat label="WP" value={save.wp.current} color={colors.wp} />
            <Stat label="골드" value={save.player.gold} color={colors.gold} />
          </View>
          <Bar label="HP" value={save.player.hp} max={stats.maxHp} color={colors.hp} />
          {/* 새로고침 버튼은 없앴다 (T16_1) — 60초 폴링과 앱 복귀가 알아서 당긴다 (§3.3) */}
          {steps.status !== 'connected' && steps.status !== 'unavailable' && (
            <View style={styles.row}>
              <Button label="Health Connect 연결" onPress={steps.connect} />
            </View>
          )}
          {steps.status !== 'connected' && (
            <Text size="sm" dim>
              {steps.status === 'unavailable'
                ? '이 기기에서 걸음을 셀 수 없습니다.'
                : 'Health Connect가 연결되지 않아 앱을 켠 동안의 걸음만 셉니다. 연결하면 워치 걸음과 지난 3일치도 반영됩니다.'}
            </Text>
          )}
        </Panel>

        {save.run ? (
          // 앱을 껐다 켜도 판이 남아 있다. 마을로 돌려보내지 않고 이어가게 한다 (§4.4)
          <Panel title="사냥 중">
            <Text>{regionById(save.regionProgress.current).name}</Text>
            <Text size="sm" dim>
              {save.run.killed}마리를 잡았습니다. 아직 안 끝났습니다.
            </Text>
            <Button label="사냥터로 돌아가기" tone="gold" onPress={() => router.push('/field')} />
          </Panel>
        ) : (
          <Panel title={`${region.name} — 입장 ${entryCost.toLocaleString()} WP`}>
            {region.fields.map((field: Field) => (
              <View key={field.id} style={styles.fieldRow}>
                <View style={styles.fieldText}>
                  <Text>{field.name}</Text>
                  <Text size="sm" dim>
                    {field.desc}
                  </Text>
                  <Text size="sm" dim>
                    소재 · {field.material.name}
                  </Text>
                </View>
                <Button
                  label="입장"
                  tone="gold"
                  disabled={save.wp.current < entryCost || save.player.hp <= 0}
                  onPress={() => {
                    if (enter(field.id)) router.push('/field');
                  }}
                />
              </View>
            ))}
            {save.player.hp <= 0 && (
              <Text size="sm" color={colors.hp}>
                HP가 0입니다. 여관이나 물약으로 회복하세요.
              </Text>
            )}
            {save.statPoints.unspent > 0 && (
              <Text size="sm" color={colors.gold}>
                쓰지 않은 스탯 포인트 {save.statPoints.unspent}점 — 캐릭터 탭에서 올리세요
              </Text>
            )}
          </Panel>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  // 컨셉 한 줄이 길어서 줄바꿈되게 한다 — 안 그러면 입장 버튼을 화면 밖으로 민다
  fieldText: { gap: space.xs, flexShrink: 1 },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: space.xs },
});
