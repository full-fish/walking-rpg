import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MONSTERS, type Monster } from '@/content';
import { beatStart, hpAfterLastHitBy, makeRng, simulateBattle } from '@/game/battle';
import { statsOf } from '@/game/progression';
import type { Save } from '@/save/schema';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { monsterIcons } from '@/ui/monsterIcons';
import { Panel } from '@/ui/Panel';
import { Stage } from '@/ui/Stage';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 한 칸 — 전투 화면과 같은 박자 */
const STEP_MS = 600;
/** 지역 → 티어 순, 보스는 그 지역 맨 끝 */
const ORDER = [...MONSTERS].sort(
  (a, b) =>
    a.region - b.region || Number(a.boss === true) - Number(b.boss === true) || a.tier - b.tier,
);

/**
 * 전투 미리보기 (설정) — 몬스터 그림과 연출을 확인하는 곳. 지금 스탯에 HP를 꽉 채워 싸우는 걸 보여 줄 뿐,
 * 세이브에는 아무것도 안 남는다(정산 · 쏜 화살 · 도감 없음). ← → 로 몬스터를 바꾸고, 끝에서 넘기면 처음으로 돈다.
 */
export default function Preview() {
  const router = useRouter();
  const save = usePlayer((s) => s.save);
  const [at, setAt] = useState(0);
  const [round, setRound] = useState(0);
  const monster = ORDER[at];
  const move = (d: number) => setAt((at + d + ORDER.length) % ORDER.length);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.row}>
        <Button label="←" onPress={() => move(-1)} />
        <View style={styles.title}>
          <Text>{monster.name}</Text>
          <Text size="sm" dim>
            {at + 1} / {ORDER.length} · 지역 {monster.region} ·{' '}
            {monster.boss ? '보스' : `티어 ${monster.tier}`} · {monster.sprite}
            {monsterIcons[monster.sprite] ? '' : ' (그림 없음)'}
          </Text>
        </View>
        <Button label="→" onPress={() => move(1)} />
      </View>
      {/* 몬스터나 판이 바뀌면 통째로 새로 만든다 — 무대의 거리 · 흔들림도 처음부터 */}
      <Fight key={`${monster.id}:${round}`} monster={monster} save={save} />
      <View style={styles.row}>
        <Button label="다시 싸우기" onPress={() => setRound(round + 1)} />
        <Button label="닫기" tone="gold" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

/** 한 판 — 들어올 때 한 번 계산해 두고 전투 화면처럼 0.6초에 한 칸씩 재생한다 */
function Fight({ monster, save }: { monster: Monster; save: Save }) {
  const arrowArt = usePlayer((s) => s.arrowArt);
  const [stats] = useState(() => statsOf(save));
  const [fight] = useState(() =>
    simulateBattle(
      { name: '나', hp: stats.maxHp, ...stats },
      { ...monster, hp: monster.maxHp },
      makeRng(Date.now()),
    ),
  );
  const [cursor, setCursor] = useState(0);
  const events = fight.events;

  useEffect(() => {
    if (cursor >= events.length) return;
    const timer = setTimeout(() => {
      // 연격 · 난무 · 반격은 한 칸에 같이 보여 준다
      let next = cursor + 1;
      while (next < events.length && events[next].chain) next++;
      setCursor(next);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [cursor, events]);

  const played = events.slice(0, cursor);
  const beat = played.length > 0 ? played.slice(beatStart(played, played.length - 1)) : [];
  const over = cursor >= events.length;

  return (
    <Panel title={over ? (fight.outcome === 'win' ? '이겼다' : '졌다') : '싸우는 중'}>
      <Bar
        label="HP"
        value={hpAfterLastHitBy(played, 'player', monster.maxHp)}
        max={monster.maxHp}
        color={colors.hp}
      />
      <Stage
        sprite={monster.sprite}
        name={monster.name}
        crd={stats.crd}
        style={stats.style}
        beat={beat}
        step={cursor}
        boss={monster.boss === true}
        art={arrowArt}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, alignItems: 'center', gap: space.xs },
});
