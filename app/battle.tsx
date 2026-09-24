import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { consumableById, fieldById } from '@/content';
import {
  hpAfterLastHitBy,
  makeRng,
  shieldLeft,
  simulateBattle,
  type BattleEvent,
  type BattleResult,
  type Combatant,
  type Outcome,
} from '@/game/battle';
import { currentMonster, type RunResult } from '@/game/field';
import { POINTS_PER_LEVEL } from '@/game/formulas';
import { equippedIn, itemDef, itemLabel } from '@/game/items';
import { statsOf } from '@/game/progression';
import type { Save } from '@/save/schema';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { BossStage } from '@/ui/BossStage';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, rarity, space } from '@/ui/theme';

/** 행동 하나를 보여주는 시간 (§4.2). */
const STEP_MS = 600;
/** 전투 기록에 남겨두는 줄 수. */
const LOG_LINES = 5;

const RESULT_LABEL = { win: '승리!', lose: '쓰러졌다...', flee: '도망쳤다' } as const;

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
 * 재생 중인 전투 하나.
 *
 * 전투는 미리 계산된 이벤트 배열이라(§4.2) 도중에 회복을 끼워 넣을 자리가 없다.
 * 물약을 마시면 **남은 싸움만 다시 뽑아 뒤에 잇는다** — 이미 재생한 이벤트는 그대로 두고
 * 커서도 안 되돌린다. 그래서 로그가 안 지워지고 재생이 끊기지 않는다 (T17).
 */
type Playback = {
  player: Combatant;
  monster: Combatant;
  /** 여러 구간을 이어 붙인 것. 인덱스가 곧 재생 순서다 */
  events: BattleEvent[];
  /** 마지막 구간의 결과. 정산은 이걸로 한다 */
  result: BattleResult;
  /** 물약을 마신 지점 — events 인덱스 → 그 순간 내 HP. 회복은 이벤트가 아니라서 따로 센다 */
  heals: { at: number; hp: number }[];
  /** 상대의 그림 — 보스전 무대가 쓴다 (T17_7) */
  sprite: string;
};

/**
 * 지금 세이브 상태로 전투 한 구간을 뽑는다. `monsterHp`를 주면 그 체력에서 이어 싸운다.
 * `shield`는 이어 싸울 때 남은 보호막이다 (T17_7) — 안 주면 새 전투라 반지 값 그대로 꽉 차 있다.
 */
function simulateFrom(save: Save, monsterHp?: number, shield?: number) {
  const picked = currentMonster(save);
  if (!picked) return null;
  const stats = statsOf(save);
  const player: Combatant = {
    name: `Lv${save.player.level} 전사`,
    hp: save.player.hp,
    ...stats,
    shield: shield ?? stats.shield,
  };
  const monster: Combatant = { ...picked, hp: monsterHp ?? picked.maxHp };
  return {
    player,
    monster,
    sprite: picked.sprite,
    result: simulateBattle(player, monster, makeRng(Date.now())),
  };
}

function startPlayback(save: Save): Playback | null {
  const seg = simulateFrom(save);
  return seg && { ...seg, events: seg.result.events, heals: [] };
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
  const [battle, setBattle] = useState(() => startPlayback(save));

  const [cursor, setCursor] = useState(0);
  const [settled, setSettled] = useState<RunResult | null>(null);
  /** 정산은 한 판에 딱 한 번. 재생 완료와 [도망]이 둘 다 여기로 들어온다. */
  const settledOnce = useRef(false);

  const total = battle?.events.length ?? 0;

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

  const played = battle.events.slice(0, cursor);
  // 몬스터 HP는 이벤트의 hpAfter가 절대값이라 구간이 나뉘어도 그냥 마지막 것을 보면 된다
  const monsterHp = hpAfterLastHitBy(played, 'player', battle.monster.hp);
  // 내 HP는 회복이 이벤트 밖에서 일어나므로, 마지막 물약 지점부터 다시 센다
  const lastHeal = battle.heals.filter((h) => h.at <= cursor).at(-1);
  const playerHp = hpAfterLastHitBy(
    played.slice(lastHeal?.at ?? 0),
    'monster',
    lastHeal?.hp ?? battle.player.hp,
  );
  const last = played.at(-1);
  const potions = Object.entries(save.run?.potions ?? {}).filter(([, n]) => n > 0);
  // 보호막은 맞은 만큼 줄고 안 찬다 (T17_7). 물약으로 이어 붙인 구간까지 한 번에 센다
  const shield = shieldLeft(played, battle.player.shield ?? 0);
  // 보스전은 그림이 공방을 주고받는 무대로 보여준다 (T17_7). 숫자도 무대에 뜬다
  const boss = battle.monster.boss === true;
  const weapon = equippedIn(save, 'weapon');

  /** 지금 HP에서 회복하고, 남은 싸움을 새로 뽑아 **뒤에 잇는다**. 커서는 안 건드린다. */
  const onDrink = (id: string) => {
    if (!drink(id, playerHp)) return;
    const healed = usePlayer.getState().save;
    const seg = simulateFrom(healed, monsterHp, shield);
    if (!seg) return;
    const kept = battle.events.slice(0, cursor);
    setBattle({
      player: battle.player,
      monster: battle.monster,
      sprite: battle.sprite,
      events: [...kept, ...seg.result.events],
      result: seg.result,
      heals: [
        ...battle.heals.filter((h) => h.at <= kept.length),
        { at: kept.length, hp: healed.player.hp },
      ],
    });
  };

  /** 로그 한 줄씩. 물약은 이벤트가 아니라서 여기서 끼워 넣는다 */
  const lines = played.flatMap((e, i) => {
    const heal = battle.heals.find((h) => h.at === i);
    const hit = {
      key: `e${i}`,
      text: `${e.actor === 'player' ? '내 공격' : battle.monster.name} → ${damageText(e)}`,
      color: eventColor(e),
    };
    return heal
      ? [{ key: `h${i}`, text: `물약을 마셨다 — HP ${heal.hp}`, color: colors.gold }, hit]
      : [hit];
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Panel title={battle.monster.name}>
        <Bar label="HP" value={monsterHp} max={battle.monster.maxHp} color={colors.hp} />
        {boss ? (
          <BossStage
            sprite={battle.sprite}
            name={battle.monster.name}
            weapon={weapon && itemDef(weapon)}
            last={last}
            step={cursor}
          />
        ) : (
          <View style={styles.popup}>
            {last?.actor === 'player' && (
              <Text size="xl" color={eventColor(last)}>
                {damageText(last)}
              </Text>
            )}
          </View>
        )}
      </Panel>

      <Panel title={battle.player.name}>
        <Bar label="HP" value={playerHp} max={battle.player.maxHp} color={colors.hp} />
        {(battle.player.shield ?? 0) > 0 && (
          <Text size="sm" color={shield > 0 ? colors.exp : colors.dim}>
            보호막 {shield} / {battle.player.shield}
          </Text>
        )}
        {!boss && (
          <View style={styles.popup}>
            {last?.actor === 'monster' && (
              <Text size="xl" color={eventColor(last)}>
                {damageText(last)}
              </Text>
            )}
          </View>
        )}
      </Panel>

      <Panel title="전투 기록">
        <View style={styles.log}>
          {lines.slice(-LOG_LINES).map((l) => (
            <Text key={l.key} size="sm" color={l.color}>
              {l.text}
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
          {settled.drop && (
            <Text color={rarity[itemDef(settled.drop).rarity]}>
              장비를 주웠다: {itemLabel(settled.drop)}
            </Text>
          )}
          {settled.dropLost && (
            <Text size="sm" color={colors.hp}>
              장비가 떨어졌지만 가방이 꽉 차 못 주웠다
            </Text>
          )}
          {settled.bossCleared && (
            <Text color={colors.gold}>
              👑 보스를 쓰러뜨렸다! 모험 탭에서 다음 지역을 해금할 수 있다
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
