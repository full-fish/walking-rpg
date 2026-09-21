import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeRng, simulateBattle, type BattleEvent, type Combatant } from '@/game/battle';
import { combatStats } from '@/game/formulas';
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
 * ponytail: 데모용 몬스터 한 마리. T11 gen-content가 진짜 데이터를 만들면 지운다.
 * 스탯은 T7 벤치가 역산한 §7.2④ BASE_* 초안의 티어 1 값이다.
 */
const DEMO_MONSTER: Combatant = {
  name: '초록 슬라임',
  hp: 132,
  maxHp: 132,
  atk: 1.62,
  def: 5.04,
  spd: 9.96,
  cri: 0.05,
  crd: 1.5,
  eva: 0.05,
};

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
  const level = usePlayer((s) => s.save.player.level);
  const savedHp = usePlayer((s) => s.save.player.hp);

  // 전투는 화면에 들어올 때 딱 한 번 계산한다.
  //
  // T8은 결과를 세이브에 쓰지 않는다 — 보상·HP 반영은 T9(progression)의 일이라
  // 매 전투가 세이브에 남은 HP에서 시작한다. HP가 0이면 시작조차 못 하므로 만피로 올린다.
  const [battle] = useState(() => {
    const stats = combatStats(level);
    const player: Combatant = { name: `Lv${level} 전사`, hp: savedHp || stats.maxHp, ...stats };
    return {
      player,
      monster: DEMO_MONSTER,
      result: simulateBattle(player, DEMO_MONSTER, makeRng(Date.now())),
    };
  });

  const [cursor, setCursor] = useState(0);
  const [fled, setFled] = useState(false);

  const finished = fled || cursor >= battle.result.events.length;
  const outcome = fled ? 'flee' : finished ? battle.result.outcome : null;

  useEffect(() => {
    if (finished) return;
    const timer = setTimeout(() => setCursor((c) => c + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [cursor, finished]);

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

      {outcome ? (
        <View style={styles.row}>
          <Text size="lg">{RESULT_LABEL[outcome]}</Text>
          <Button label="돌아가기" tone="gold" onPress={() => router.back()} />
        </View>
      ) : (
        // 도망은 재생을 멈추기만 한다. HP는 멈춘 시점 값이 그대로 남는다 (§4.2).
        <Button label="도망" onPress={() => setFled(true)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  // 팝업이 떴다 사라져도 레이아웃이 흔들리지 않게 자리를 비워둔다.
  popup: { height: 32, justifyContent: 'center' },
  // 로그가 채워지는 동안 패널 높이가 커지지 않게 미리 자리를 잡아둔다.
  log: { minHeight: LOG_LINES * 18, gap: space.xs },
});
