import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bossOf, REGIONS, regionById, type Field } from '@/content';
import { goalsReady, streakNext } from '@/game/daily';
import { fieldEntryCost } from '@/game/field';
import { ARROW, REGION_COUNT, WP_COST } from '@/game/formulas';
import { bagFull, styleOf } from '@/game/items';
import { statsOf } from '@/game/progression';
import { bossCost, bossState, unlockCost } from '@/game/region';
import { useSteps } from '@/health/useSteps';
import { trades, usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';
import { Today } from '@/ui/Today';

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

/** 모험 탭 안의 칸 (T19 검수 2차) — 사냥터 · 보스 · 해금 · 이동 · 걸음 목표 · 출석을 한 페이지에 두니 길었다 */
const TABS = ['사냥', '지역', '보상'] as const;
type Tab = (typeof TABS)[number];

/** 모험 탭. 상단 HUD 아래로 [사냥] [지역] [보상] */
export default function Adventure() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('사냥');
  const steps = useSteps();
  const save = usePlayer((s) => s.save);
  const grantFromSteps = usePlayer((s) => s.grantFromSteps);
  const regen = usePlayer((s) => s.regen);
  const enter = usePlayer((s) => s.enter);
  const trade = usePlayer((s) => s.trade);
  const stats = statsOf(save);
  const region = regionById(save.regionProgress.current);
  // 나그네의 반지(T17_7)만큼 깎인 값 — 실제로 내는 값을 보여준다
  const entryCost = fieldEntryCost(save, region.id);
  const arrowsLeft = save.quiver ? (save.arrows[save.quiver] ?? 0) : 0;
  const { unlocked } = save.regionProgress;
  const boss = bossOf(region.id);
  const bossNow = bossState(save, region.id);
  // 받을 게 있으면 [보상 ●] — 칸을 열어 보지 않아도 안다
  const now = new Date();
  const rewardReady = streakNext(save, now) !== null || goalsReady(save, now).length > 0;

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

        {/* 한 페이지에 다 있으면 길어서 셋으로 쪼갰다 (T19 검수 2차). 열면 늘 [사냥]부터 — 제일 자주 누른다 */}
        <View style={styles.row}>
          {TABS.map((t) => (
            <Button
              key={t}
              label={t === '보상' && rewardReady ? '보상 ●' : t}
              tone={t === tab ? 'gold' : 'normal'}
              onPress={() => setTab(t)}
            />
          ))}
        </View>

        {tab === '보상' ? (
          // 걸음 목표 · 출석 (T19) — 둘 다 [받기]를 눌러야 들어온다. 판 안에서도 받는다
          <Today />
        ) : save.run ? (
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
        ) : tab === '지역' ? (
          <>
            {/* 지역 관문 (T17_5) — 보스 도전 · 해금 · 이동은 따로 낸다 (§4.1) */}
            <Panel title={`보스 — ${boss.name}`}>
              {bossNow === 'cleared' ? (
                <>
                  {unlocked === region.id && region.id < REGION_COUNT ? (
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
                  )}
                  {/* 재사냥 (T19 검수) — 추억과 도감용. 장비 · 해금은 첫 처치 때만 */}
                  <View style={styles.fieldRow}>
                    <Text size="sm" dim style={styles.fieldText}>
                      다시 잡으면 EXP · 골드와 도감 한 단계만 준다 (장비 없음).
                    </Text>
                    <Button
                      label={`재사냥 ${bossCost(save, region.id).toLocaleString()} WP`}
                      disabled={save.wp.current < bossCost(save, region.id) || save.player.hp <= 0}
                      onPress={() => {
                        if (trade(trades.challengeBoss())) router.push('/field');
                      }}
                    />
                  </View>
                </>
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
                      if (trade(trades.challengeBoss())) router.push('/field');
                    }}
                  />
                </View>
              )}
            </Panel>

            <Panel title={`지역 이동 — ${WP_COST.regionTravel.toLocaleString()} WP (매번)`}>
              {REGIONS.map((r) => (
                <View key={r.id} style={styles.fieldRow}>
                  <Text dim={r.id > unlocked}>
                    {r.id}. {r.name}
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
          </>
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
            {/* 활 (T18) — 화살은 판에 가진 걸 다 들고 가서 쏠 때마다 1발. 떨어지면 30%로 친다 */}
            {styleOf(save) === 'bow' && arrowsLeft < ARROW.low && (
              <Text size="sm" color={colors.hp}>
                화살 {arrowsLeft}발 — 떨어지면 활로 칩니다(30%). 상점에서 삽니다
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
