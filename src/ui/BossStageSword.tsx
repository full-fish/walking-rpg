import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import type { Equipment } from '@/content';
import type { BattleEvent } from '@/game/battle';
import { ItemIcon } from '@/ui/ItemCell';
import { monsterIcons } from '@/ui/monsterIcons';
import { Text } from '@/ui/Text';
import { border, colors } from '@/ui/theme';

/** 무대 높이와 보스 그림 크기 (T17_7). 보스는 왼쪽, 나는 오른쪽 아래 — 그림 속 보스가 오른쪽을 본다 */
const STAGE = 250;
const BOSS = 210;
const HERO = 64;

/** 방금 행동 → 무대에 뜨는 글자. 내 공격은 보스 위에, 보스 공격은 내 위에 뜬다 */
function popupOf(e: BattleEvent) {
  const mine = e.actor === 'player';
  const at = mine ? styles.atBoss : styles.atHero;
  if (e.type === 'miss') {
    return {
      text: mine ? '빗나감' : '회피!',
      color: mine ? colors.dim : colors.wp,
      big: false,
      at,
    };
  }
  const crit = e.type === 'crit';
  const color = crit ? colors.gold : mine ? colors.text : colors.hp;
  return { text: crit ? `치명타! ${e.value}` : `${e.value}`, color, big: crit, at };
}

/** 한 번 움직이고 제자리로. 부딪히는 순간까지가 `hit`ms, 돌아오는 데 `back`ms */
function lunge(v: Animated.ValueXY, x: number, y: number, hit: number, back: number) {
  return Animated.sequence([
    Animated.timing(v, { toValue: { x, y }, duration: hit, useNativeDriver: true }),
    Animated.timing(v, { toValue: { x: 0, y: 0 }, duration: back, useNativeDriver: true }),
  ]);
}

/** 좌우로 몇 번 떨고 멈춘다 — 세게 맞을수록 `amp`가 크다 */
function shake(v: Animated.Value, amp: number) {
  return Animated.sequence(
    [amp, -amp * 0.8, amp * 0.5, -amp * 0.25, 0].map((toValue) =>
      Animated.timing(v, { toValue, duration: 45, useNativeDriver: true }),
    ),
  );
}

/** 번쩍 켜졌다 꺼진다. 앞에 delay를 두면 그때 켜진다 */
function flash(v: Animated.Value, peak: number, duration: number) {
  return Animated.sequence([
    Animated.timing(v, { toValue: peak, duration: 30, useNativeDriver: true }),
    Animated.timing(v, { toValue: 0, duration, useNativeDriver: true }),
  ]);
}

/**
 * 보스전 무대 — **칼 버전 백업** (T17_7). 지금 쓰는 건 적만 보이는 BossStage(T17_7 검수 4차)다.
 * 되돌리려면 app/battle.tsx의 import 한 줄을 `BossStageSword as BossStage`로 바꾸면 된다 — 받는 값이 같다.
 *
 * 보스 그림과 내 무기가 공방을 주고받는다. **아무것도 계산하지 않는다** —
 * 전투 화면이 재생하는 이벤트(`last`)를 받아 움직이기만 한다. `step`이 바뀔 때마다 한 번 움직인다
 * (물약으로 이어 붙인 구간은 seq가 0부터 다시 세서 seq로는 못 가른다).
 *
 *   내 공격  무기가 보스 쪽으로 찌르고 → 보스가 떨며 하얗게 번쩍인다. 숫자가 보스 위로 뜬다
 *   치명타   떨림이 크고 무대 전체가 번쩍인다. 숫자가 크고 금색이다
 *   빗나감   보스가 옆으로 비킨다
 *   보스 공격 보스가 덮쳐 오고 → 무대가 흔들리며 붉게 번쩍인다
 *   회피     내 무기가 옆으로 비킨다
 */
export function BossStageSword({
  sprite,
  name,
  weapon,
  last,
  step,
}: {
  sprite: string;
  name: string;
  /** 낀 무기 — 아직 캐릭터 그림이 없어서 무기가 나 대신 싸운다 */
  weapon?: Equipment;
  last?: BattleEvent;
  step: number;
}) {
  const art = monsterIcons[sprite];
  // 움직임 값은 한 번 만들어 끝까지 쓴다 — 렌더마다 새로 만들면 움직이던 게 끊긴다
  const [boss] = useState(() => new Animated.ValueXY());
  const [bossScale] = useState(() => new Animated.Value(1));
  const [bossFlash] = useState(() => new Animated.Value(0));
  const [hero] = useState(() => new Animated.ValueXY());
  const [stageShake] = useState(() => new Animated.Value(0));
  const [stageFlash] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(1));
  const popup = last && popupOf(last);
  // 무대 번쩍임 색 — 내가 치명타를 내면 하얗게, 내가 맞으면 붉게
  const tint = last?.actor === 'monster' ? colors.hp : colors.text;

  useEffect(() => {
    if (!last) return;
    const crit = last.type === 'crit';
    const miss = last.type === 'miss';
    const mine = last.actor === 'player';
    rise.setValue(0);

    let impact: Animated.CompositeAnimation;
    if (mine) {
      // 내가 친다 — 무기가 왼쪽 위(보스)로 찔렀다 돌아온다
      const attack = lunge(hero, -90, -50, 110, 220);
      if (miss) {
        impact = Animated.parallel([
          attack,
          Animated.sequence([Animated.delay(80), lunge(boss, -22, -14, 90, 200)]),
        ]);
      } else {
        impact = Animated.parallel([
          attack,
          Animated.sequence([
            Animated.delay(110),
            Animated.parallel([
              shake(boss.x, crit ? 18 : 9),
              flash(bossFlash, 0.85, crit ? 320 : 220),
              Animated.sequence([
                Animated.timing(bossScale, {
                  toValue: crit ? 0.9 : 0.96,
                  duration: 60,
                  useNativeDriver: true,
                }),
                Animated.timing(bossScale, { toValue: 1, duration: 160, useNativeDriver: true }),
              ]),
              ...(crit ? [flash(stageFlash, 0.55, 300)] : []),
            ]),
          ]),
        ]);
      }
    } else {
      // 보스가 친다 — 오른쪽 아래(나)로 덮쳐 왔다 물러난다
      const attack = Animated.parallel([
        lunge(boss, 46, 22, 120, 230),
        Animated.sequence([
          Animated.timing(bossScale, { toValue: 1.1, duration: 120, useNativeDriver: true }),
          Animated.timing(bossScale, { toValue: 1, duration: 230, useNativeDriver: true }),
        ]),
      ]);
      if (miss) {
        impact = Animated.parallel([
          attack,
          Animated.sequence([Animated.delay(90), lunge(hero, 16, -28, 90, 200)]),
        ]);
      } else {
        impact = Animated.parallel([
          attack,
          Animated.sequence([
            Animated.delay(120),
            Animated.parallel([
              shake(stageShake, crit ? 16 : 8),
              flash(stageFlash, crit ? 0.55 : 0.3, 280),
            ]),
          ]),
        ]);
      }
    }

    // 숫자는 부딪히는 순간 떠서 올라가며 사라진다 — 다음 행동(0.6초 뒤) 전에 끝난다
    Animated.parallel([
      impact,
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(rise, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    ]).start();
    // step이 바뀔 때만 움직인다 — 물약으로 전투를 이어 붙여도 이미 보여준 행동을 다시 움직이지 않는다.
    // last는 step과 같이 바뀌고, 나머지는 처음 한 번 만든 움직임 값이라 바뀌지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const float = {
    opacity: rise.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] }),
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
  };

  return (
    <Animated.View style={[styles.stage, { transform: [{ translateX: stageShake }] }]}>
      <Animated.View
        style={[
          styles.boss,
          { transform: [{ translateX: boss.x }, { translateY: boss.y }, { scale: bossScale }] },
        ]}
      >
        {art ? (
          <>
            <Image source={art} style={styles.art} resizeMode="contain" />
            {/* 맞는 순간 하얀 실루엣을 덮는다 — 투명 배경이라 그림 모양대로 번쩍인다 */}
            <Animated.Image
              source={art}
              style={[styles.art, styles.over, { tintColor: '#FFFFFF', opacity: bossFlash }]}
              resizeMode="contain"
            />
          </>
        ) : (
          // 아직 그림이 없는 보스 — 자리만 잡고 이름을 쓴다 (sprite-list.md의 boss_r2~5)
          <View style={[styles.art, styles.blank]}>
            <Text dim>{name}</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View
        style={[styles.hero, { transform: [{ translateX: hero.x }, { translateY: hero.y }] }]}
      >
        {weapon ? <ItemIcon def={weapon} size={HERO} /> : <Text dim>맨손</Text>}
      </Animated.View>

      {popup && (
        <Animated.View pointerEvents="none" style={[styles.popup, popup.at, float]}>
          <Text size={popup.big ? 'xl' : 'lg'} color={popup.color}>
            {popup.text}
          </Text>
        </Animated.View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.over, { backgroundColor: tint, opacity: stageFlash }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: STAGE,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderWidth: border,
    borderColor: colors.edge,
  },
  boss: { position: 'absolute', left: 4, top: 8, width: BOSS, height: BOSS },
  art: { width: BOSS, height: BOSS },
  over: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blank: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border,
    borderColor: colors.edge,
  },
  hero: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    width: HERO,
    height: HERO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popup: { position: 'absolute', alignItems: 'center' },
  atBoss: { left: 0, width: BOSS, top: 60 },
  atHero: { right: 0, width: HERO + 60, bottom: HERO + 24 },
});
