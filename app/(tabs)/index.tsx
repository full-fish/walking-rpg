import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bossOf, REGIONS, regionById, type Field } from '@/content';
import { regionMaterials } from '@/game/economy';
import { BOSS_BUFF, REGION_COUNT, WP_COST } from '@/game/formulas';
import { bagFull } from '@/game/items';
import { statsOf } from '@/game/progression';
import { bossCost, bossState, unlockCost } from '@/game/region';
import { useSteps } from '@/health/useSteps';
import { trades, usePlayer } from '@/stores/usePlayer';
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
  const trade = usePlayer((s) => s.trade);
  const stats = statsOf(save);
  const region = regionById(save.regionProgress.current);
  const entryCost = WP_COST.fieldEntry(region.id);
  const { unlocked } = save.regionProgress;
  const boss = bossOf(region.id);
  const bossNow = bossState(save, region.id);
  /** 보스 버프에 쓸 소재 수 (T17_6 검수). 가진 것보다 많이 고를 수는 없다 */
  const [buffs, setBuffs] = useState(0);
  const haveMaterials = regionMaterials(save, region.id);
  const useMaterials = Math.min(buffs, haveMaterials);

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
          <Panel title={save.run.boss ? '보스전 중' : '사냥 중'}>
            <Text>{regionById(save.regionProgress.current).name}</Text>
            <Text size="sm" dim>
              {save.run.boss
                ? `${boss.name}와(과) 싸우는 중입니다.`
                : `${save.run.killed}마리를 잡았습니다. 아직 안 끝났습니다.`}
            </Text>
            <Button label="돌아가기" tone="gold" onPress={() => router.push('/field')} />
          </Panel>
        ) : (
          <>
            {/* 지역 관문 (T17_5) — 보스 도전 · 해금 · 이동은 따로 낸다 (§4.1) */}
            <Panel title={`보스 — ${boss.name}`}>
              {bossNow === 'cleared' ? (
                unlocked === region.id && region.id < REGION_COUNT ? (
                  <View style={styles.fieldRow}>
                    <Text size="sm" dim>
                      쓰러뜨렸다. {regionById(region.id + 1).name}을(를) 열 수 있다.
                    </Text>
                    <Button
                      label={`해금 ${unlockCost(save).toLocaleString()} WP`}
                      tone="gold"
                      disabled={save.wp.current < unlockCost(save)}
                      onPress={() => trade(trades.unlockRegion())}
                    />
                  </View>
                ) : (
                  <Text size="sm" dim>
                    쓰러뜨렸다.
                  </Text>
                )
              ) : (
                <View style={styles.fieldRow}>
                  <View style={styles.fieldText}>
                    <Text size="sm" dim>
                      1:1 전투. 물약은 3개까지. 이기면 다음 지역 장비를 하나 확정으로 준다.
                    </Text>
                    {bossNow === 'tried' && (
                      <Text size="sm" dim>
                        한 번 들어갔다 — 이제부터 재도전 값이다.
                      </Text>
                    )}
                    {bagFull(save) && (
                      <Text size="sm" color={colors.hp}>
                        가방이 꽉 차 있으면 들어갈 수 없다 (보상 받을 칸).
                      </Text>
                    )}
                  </View>
                  <Button
                    label={`도전 ${bossCost(save, region.id).toLocaleString()} WP`}
                    tone="gold"
                    disabled={
                      save.wp.current < bossCost(save, region.id) ||
                      save.player.hp <= 0 ||
                      bagFull(save)
                    }
                    onPress={() => {
                      if (trade(trades.challengeBoss(useMaterials))) router.push('/field');
                    }}
                  />
                </View>
              )}
              {/* 보스 버프 (T17_6 검수) — 소재 하나에 무작위 버프 하나. 뭐가 붙을지는 들어가서 본다 */}
              {bossNow !== 'cleared' && (
                <>
                  <Text size="sm" dim>
                    소재를 쓰면 하나에 하나씩 무작위 버프(전투력 값 ×{BOSS_BUFF.mult}) — 이 지역
                    소재 {haveMaterials}개
                  </Text>
                  <View style={styles.row}>
                    {Array.from({ length: BOSS_BUFF.max + 1 }, (_, n) => (
                      <Button
                        key={n}
                        label={`소재 ${n}`}
                        tone={n === useMaterials ? 'gold' : 'normal'}
                        disabled={n > haveMaterials}
                        onPress={() => setBuffs(n)}
                      />
                    ))}
                  </View>
                </>
              )}
            </Panel>

            <Panel title={`지역 이동 — ${WP_COST.regionTravel.toLocaleString()} WP (매번)`}>
              {REGIONS.map((r) => (
                <View key={r.id} style={styles.fieldRow}>
                  <Text dim={r.id > unlocked}>
                    {r.id}. {r.name} (Lv{r.levelRange[0]}~{r.levelRange[1]})
                  </Text>
                  {r.id === region.id ? (
                    <Text size="sm" color={colors.gold}>
                      여기
                    </Text>
                  ) : r.id > unlocked ? (
                    <Text size="sm" dim>
                      잠김
                    </Text>
                  ) : (
                    <Button
                      label="이동"
                      disabled={save.wp.current < WP_COST.regionTravel}
                      onPress={() => trade(trades.travel(r.id))}
                    />
                  )}
                </View>
              ))}
            </Panel>

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
          </>
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
