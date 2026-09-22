import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { consumableById, fieldById } from '@/content';
import { makeRng, simulateBattle, type BattleEvent, type Combatant, type Outcome } from '@/game/battle';
import { currentMonster, type RunResult } from '@/game/field';
import { POINTS_PER_LEVEL } from '@/game/formulas';
import { statsOf } from '@/game/progression';
import type { Save } from '@/save/schema';
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
 * 한 번에 계산해 둘 전투 하나. `monsterHp`를 주면 그 체력에서 이어서 싸운다.
 *
 * 물약을 마시면 여기를 **다시** 부른다 — 전투가 미리 계산된 재생이라(§4.2)
 * 도중에 회복을 끼워 넣을 자리가 없고, 남은 싸움을 새 HP로 다시 뽑는 수밖에 없다.
 */
function buildBattle(save: Save, monsterHp?: number) {
  const picked = currentMonster(save);
  if (!picked) return null;
  const player: Combatant = {
    name: `Lv${save.player.level} 전사`,
    hp: save.player.hp,
    ...statsOf(save),
  };
  const monster: Combatant = { ...picked, hp: monsterHp ?? picked.maxHp };
  return { player, monster, result: simulateBattle(player, monster, makeRng(Date.now())) };
}

/**
 * 몬스터 1마리와의 전투 화면. 상대는 **진행 중인 판(save.run)이 정해 둔 한 마리**다.
 * 판 전체(2~6마리)의 진행은 app/field.tsx가 맡는다 (§4.4).
 *
 * 여기서는 아무것도 계산하지 않는다 — 들어올 때 T7 엔진이 한 번에 계산해 둔
 * 이벤트 배열을 0.6초에 하나씩 재생만 한다 (§4.2).
 */
export default function Battle() {
  const router = useRouter();
  const finishBattle = usePlayer((s) => s.finishBattle);
  const drink = usePlayer((s) => s.drink);
  const save = usePlayer((s) => s.save);

  // 전투는 화면에 들어올 때 계산한다. 세이브에 남은 HP에서 이어서 싸운다 (§4.2).
  const [battle, setBattle] = useState(() => buildBattle(save));

  const [cursor, setCursor] = useState(0);
  const [settled, setSettled] = useState<RunResult | null>(null);
  /** 정산은 한 판에 딱 한 번. 재생 완료와 [도망]이 둘 다 여기로 들어온다. */
  const settledOnce = useRef(false);

  const total = battle?.result.events.length ?? 0;

  const finish = useCallback(
    (outcome: Outcome, hp: number) => {
      if (settledOnce.current) return;
      settledOnce.current = true;
      setSettled(finishBattle(outcome, hp));
    },
    [finishBattle],
  );

  useEffect(() => {
    if (!battle || cursor >= total || settledOnce.current) return;
    const timer = setTimeout(() => {
      const next = cursor + 1;
      setCursor(next);
      // 마지막 행동을 보여준 그 순간 정산한다. 남은 HP는 엔진이 이미 계산해 뒀다.
      if (next >= total) finish(battle.result.outcome, battle.result.playerHp);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [battle, cursor, total, finish]);

  // 판 밖에서 열릴 경로는 없지만, 세이브가 꼬였을 때 흰 화면 대신 돌아갈 길을 준다
  if (!battle) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <Panel>
          <Text>진행 중인 사냥이 없습니다.</Text>
          <Button label="돌아가기" tone="gold" onPress={() => router.replace('/')} />
        </Panel>
      </SafeAreaView>
    );
  }

  const played = battle.result.events.slice(0, cursor);
  const monsterHp = hpAfterLastHitBy(played, 'player', battle.monster.hp);
  const playerHp = hpAfterLastHitBy(played, 'monster', battle.player.hp);
  const last = played.at(-1);
  const potions = Object.entries(save.run?.potions ?? {}).filter(([, n]) => n > 0);

  /** 재생을 멈추고 지금 HP에서 회복한 뒤, 남은 싸움을 다시 뽑는다. */
  const onDrink = (id: string) => {
    if (!drink(id, playerHp)) return;
    setBattle(buildBattle(usePlayer.getState().save, monsterHp));
    setCursor(0);
  };

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
          {settled.cleared && (
            <Text color={colors.gold}>
              🏆 사냥터를 정리했다! 보너스 EXP +{settled.bonus.exp} · 골드 +{settled.bonus.gold}
            </Text>
          )}
          {settled.material && (
            <Text color={colors.gold}>
              {fieldById(settled.material).material.name}을(를) 얻었다
            </Text>
          )}
          {settled.goldLost > 0 && (
            <Text size="sm" color={colors.hp}>
              골드 {settled.goldLost}를 잃었다
            </Text>
          )}
          {/* 남은 마릿수는 끝까지 안 보여준다 (§4.4). "또 다른 기척"만 알린다 */}
          {!settled.over && <Text size="sm">또 다른 기척이 느껴진다...</Text>}
          <Button
            label={settled.over ? '마을로' : '사냥터로'}
            tone="gold"
            onPress={() => (settled.over ? router.replace('/') : router.replace('/field'))}
          />
        </Panel>
      ) : (
        <View style={styles.actions}>
          {potions.map(([id, n]) => (
            <Button
              key={id}
              label={`${consumableById(id).name} ×${n}`}
              tone="gold"
              disabled={playerHp >= battle.player.maxHp}
              onPress={() => onDrink(id)}
            />
          ))}
          {/* 도망은 재생을 멈추고 그 시점 HP로 정산한다. 항상 성공한다 (§4.2). */}
          <Button label="도망" onPress={() => finish('flee', playerHp)} />
        </View>
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
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
