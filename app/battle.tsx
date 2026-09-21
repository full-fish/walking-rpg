import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { monstersOfField, regionById } from '@/content';
import { makeRng, simulateBattle, type BattleEvent, type Combatant, type Outcome } from '@/game/battle';
import { POINTS_PER_LEVEL } from '@/game/formulas';
import { killReward, statsOf, type Settlement } from '@/game/progression';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 행동 하나를 보여주는 시간 (§4.2). */
const STEP_MS = 600;
/** 전투 기록에 남겨두는 줄 수. */
const LOG_LINES = 5;

const RESULT_LABEL = { win: '승리!', lose: '쓰러졌다...', flee: '도망쳤다' } as const;

/**
 * T16이 사냥터 선택을 붙이기 전까지는 지역 1의 첫 사냥터로 직행한다.
 * 모험 탭도 같은 곳을 보여주므로 둘이 어긋나지 않는다.
 */
const FIELD = regionById(1).fields[0];

/** 마지막으로 actor가 때렸을 때 맞은 쪽의 HP. 아직 안 맞았으면 초기값. */
function hpAfterLastHitBy(events: BattleEvent[], actor: BattleEvent['actor'], initial: number) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].actor === actor) return events[i].hpAfter;
  }
  return initial;
}

function damageText(event: BattleEvent) {
  if (event.type === 'miss') return '빗나갔다';
  return event.type === 'crit' ? `치명타! ${event.value}` : `${event.value}`;
}

function eventColor(event: BattleEvent) {
  if (event.type === 'miss') return colors.dim;
  if (event.type === 'crit') return colors.gold;
  return event.actor === 'player' ? colors.text : colors.hp;
}

/**
 * 몬스터 1마리와의 전투 화면. 판 전체 진행은 T16의 app/field.tsx가 맡는다.
 *
 * 여기서는 아무것도 계산하지 않는다 — 들어올 때 T7 엔진이 한 번에 계산해 둔
 * 이벤트 배열을 0.6초에 하나씩 재생만 한다 (§4.2).
 */
export default function Battle() {
  const router = useRouter();
  const settle = usePlayer((s) => s.settle);
  const save = usePlayer((s) => s.save);

  // 전투는 화면에 들어올 때 딱 한 번 계산한다. 세이브에 남은 HP에서 이어서 싸운다 (§4.2).
  const [battle] = useState(() => {
    const stats = statsOf(save);
    const player: Combatant = {
      name: `Lv${save.player.level} 전사`,
      hp: save.player.hp,
      ...stats,
    };
    // 이 사냥터의 몬스터 풀에서 한 마리. 한 판(2~6마리) 진행은 T16이 맡는다.
    const pool = monstersOfField(FIELD);
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const monster: Combatant = { ...picked, hp: picked.maxHp };
    return {
      player,
      monster,
      reward: killReward(picked, stats.goldFind),
      result: simulateBattle(player, monster, makeRng(Date.now())),
    };
  });

  const [cursor, setCursor] = useState(0);
  const [settled, setSettled] = useState<Settlement | null>(null);
  /** 정산은 한 판에 딱 한 번. 재생 완료와 [도망]이 둘 다 여기로 들어온다. */
  const settledOnce = useRef(false);

  const total = battle.result.events.length;

  const finish = useCallback(
    (outcome: Outcome, hp: number) => {
      if (settledOnce.current) return;
      settledOnce.current = true;
      setSettled(settle(outcome, hp, battle.reward));
    },
    [settle, battle.reward],
  );

  useEffect(() => {
    if (cursor >= total || settledOnce.current) return;
    const timer = setTimeout(() => {
      const next = cursor + 1;
      setCursor(next);
      // 마지막 행동을 보여준 그 순간 정산한다. 남은 HP는 엔진이 이미 계산해 뒀다.
      if (next >= total) finish(battle.result.outcome, battle.result.playerHp);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [cursor, total, battle.result.outcome, battle.result.playerHp, finish]);

  const played = battle.result.events.slice(0, cursor);
  const monsterHp = hpAfterLastHitBy(played, 'player', battle.monster.hp);
  const playerHp = hpAfterLastHitBy(played, 'monster', battle.player.hp);
  const last = played.at(-1);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Panel title={battle.monster.name}>
        <Bar label="HP" value={monsterHp} max={battle.monster.maxHp} color={colors.hp} />
        <View style={styles.popup}>
          {last?.actor === 'player' && (
            <Text size="xl" color={eventColor(last)}>
              {damageText(last)}
            </Text>
          )}
        </View>
      </Panel>

      <Panel title={battle.player.name}>
        <Bar label="HP" value={playerHp} max={battle.player.maxHp} color={colors.hp} />
        <View style={styles.popup}>
          {last?.actor === 'monster' && (
            <Text size="xl" color={eventColor(last)}>
              {damageText(last)}
            </Text>
          )}
        </View>
      </Panel>

      <Panel title="전투 기록">
        <View style={styles.log}>
          {played.slice(-LOG_LINES).map((e) => (
            <Text key={e.seq} size="sm" color={eventColor(e)}>
              {e.actor === 'player' ? '내 공격' : battle.monster.name} → {damageText(e)}
            </Text>
          ))}
        </View>
      </Panel>

      {settled ? (
        <Panel>
          <Text size="lg">{RESULT_LABEL[settled.outcome]}</Text>
          {settled.gained.exp > 0 && (
            <Text size="sm">
              EXP +{settled.gained.exp} · 골드 +{settled.gained.gold}
            </Text>
          )}
          {settled.levelsGained > 0 && (
            <Text color={colors.gold}>
              레벨 업! Lv {settled.save.player.level} (스탯 포인트 +
              {settled.levelsGained * POINTS_PER_LEVEL})
            </Text>
          )}
          {settled.goldLost > 0 && (
            <Text size="sm" color={colors.hp}>
              골드 {settled.goldLost}를 잃었다
            </Text>
          )}
          <Button label="돌아가기" tone="gold" onPress={() => router.back()} />
        </Panel>
      ) : (
        // 도망은 재생을 멈추고 그 시점 HP로 정산한다. 항상 성공한다 (§4.2).
        <Button label="도망" onPress={() => finish('flee', playerHp)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  // 팝업이 떴다 사라져도 레이아웃이 흔들리지 않게 자리를 비워둔다.
  popup: { height: 32, justifyContent: 'center' },
  // 로그가 채워지는 동안 패널 높이가 커지지 않게 미리 자리를 잡아둔다.
  log: { minHeight: LOG_LINES * 18, gap: space.xs },
});
