import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import type { Equipment } from '@/content';
import type { BattleEvent } from '@/game/battle';
import { monsterIcons } from '@/ui/monsterIcons';
import { Text } from '@/ui/Text';
import { border, colors } from '@/ui/theme';

/** 무대 높이와 보스 그림 크기 (T17_7 검수 4차). 보스가 한가운데 — 나는 화면 이쪽(카메라)이다 */
const STAGE = 260;
const BOSS = 220;
/** 베기 자국 길이·굵기, 할퀸 자국 길이 */
const SLASH = 250;
const CLAW = 170;

/** 방금 행동 → 무대에 뜨는 글자. 내 공격은 보스 위에, 보스 공격은 화면 아래(내 쪽)에 뜬다 */
function popupOf(e: BattleEvent) {
  const mine = e.actor === 'player';
  const at = mine ? styles.atBoss : styles.atMe;
  if (e.type === 'miss') {
    return {
      text: mine ? '빗나감' : '회피!',
      color: mine ? colors.dim : colors.wp,
      big: !mine,
      at,
    };
  }
  const crit = e.type === 'crit';
  const color = crit ? colors.gold : mine ? colors.text : colors.hp;
  const value = mine ? `${e.value}` : `-${e.value}`;
  return { text: crit ? `치명타! ${value}` : value, color, big: crit || !mine, at };
}

/** 좌우로 몇 번 떨고 멈춘다 — 세게 맞을수록 `amp`가 크다 */
function shake(v: Animated.Value, amp: number) {
  return Animated.sequence(
    [amp, -amp * 0.8, amp * 0.5, -amp * 0.25, 0].map((toValue) =>
      Animated.timing(v, { toValue, duration: 45, useNativeDriver: true }),
    ),
  );
}

/** 번쩍 켜졌다 꺼진다 */
function flash(v: Animated.Value, peak: number, duration: number) {
  return Animated.sequence([
    Animated.timing(v, { toValue: peak, duration: 30, useNativeDriver: true }),
    Animated.timing(v, { toValue: 0, duration, useNativeDriver: true }),
  ]);
}

/** 한 번 가고 제자리로. 가는 데 `go`ms, 돌아오는 데 `back`ms */
function swing(v: Animated.Value, to: number, go: number, back: number) {
  return Animated.sequence([
    Animated.timing(v, { toValue: to, duration: go, useNativeDriver: true }),
    Animated.timing(v, { toValue: 0, duration: back, useNativeDriver: true }),
  ]);
}

/** 자국이 그어지고(`draw`ms) 잠깐 남았다가 사라진다 */
function streak(draw: Animated.Value, fade: Animated.Value, ms: number, peak = 1) {
  draw.setValue(0);
  return Animated.parallel([
    Animated.timing(draw, { toValue: 1, duration: ms, useNativeDriver: true }),
    flash(fade, peak, 260),
  ]);
}

/**
 * 보스전 무대 (T17_7 검수 4차) — **적만 보인다.** 나는 화면 이쪽(1인칭)이라 캐릭터 그림이 필요 없다.
 * 칼이 싸우던 버전은 BossStageSword로 남겨 뒀다 — 받는 값이 같아서 import 한 줄로 바꿔 끼운다.
 * **아무것도 계산하지 않는다** — 전투 화면이 재생하는 이벤트(`last`)를 받아 움직이기만 한다.
 * `step`이 바뀔 때마다 한 번 움직인다(물약으로 이어 붙인 구간은 seq가 0부터 다시 세서 seq로는 못 가른다).
 *
 *   내 공격  보스 위로 하얀 베기 자국 → 보스가 떨며 하얗게 번쩍인다. 숫자가 보스 위로 뜬다
 *   치명타   X자로 두 번 긋는 금색 자국. 떨림이 크고 무대 전체가 번쩍인다
 *   빗나감   자국이 흐리게 지나가고 보스가 옆으로 비킨다
 *   보스 공격 보스가 화면 쪽으로 덮쳐 오고 → 붉은 할퀸 자국 셋 · 화면이 흔들리며 붉게 번쩍인다. 숫자는 아래
 *   회피     보스가 덮쳐 오는데 화면(내 시점)이 옆으로 비킨다
 */
export function BossStage({
  sprite,
  name,
  last,
  step,
}: {
  sprite: string;
  name: string;
  /** 칼 버전(BossStageSword)과 같은 모양으로 받으려고 둔다 — 여기서는 안 쓴다 */
  weapon?: Equipment;
  last?: BattleEvent;
  step: number;
}) {
  const art = monsterIcons[sprite];
  // 움직임 값은 한 번 만들어 끝까지 쓴다 — 렌더마다 새로 만들면 움직이던 게 끊긴다
  const [bossX] = useState(() => new Animated.Value(0));
  const [bossY] = useState(() => new Animated.Value(0));
  const [bossScale] = useState(() => new Animated.Value(1));
  const [bossFlash] = useState(() => new Animated.Value(0));
  const [slash] = useState(() => new Animated.Value(0));
  const [slashFade] = useState(() => new Animated.Value(0));
  const [claw] = useState(() => new Animated.Value(0));
  const [clawFade] = useState(() => new Animated.Value(0));
  const [view] = useState(() => new Animated.Value(0));
  const [stageFlash] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(1));
  const popup = last && popupOf(last);
  const crit = last?.type === 'crit';
  // 무대 번쩍임 색 — 내가 치명타를 내면 하얗게, 내가 맞으면 붉게
  const tint = last?.actor === 'monster' ? colors.hp : colors.text;
  // 베기 자국 색 — 치명타는 금색
  const edge = crit ? colors.gold : colors.text;

  useEffect(() => {
    if (!last) return;
    const miss = last.type === 'miss';
    const heavy = last.type === 'crit';
    rise.setValue(0);

    let impact: Animated.CompositeAnimation;
    if (last.actor === 'player') {
      if (miss) {
        // 흐린 자국이 지나가는 사이 보스가 옆으로 비킨다
        impact = Animated.parallel([
          streak(slash, slashFade, 140, 0.4),
          swing(bossX, -46, 110, 220),
        ]);
      } else {
        impact = Animated.parallel([
          streak(slash, slashFade, heavy ? 150 : 110),
          Animated.sequence([
            Animated.delay(80),
            Animated.parallel([
              shake(bossX, heavy ? 18 : 9),
              flash(bossFlash, 0.85, heavy ? 320 : 220),
              Animated.sequence([
                Animated.timing(bossScale, {
                  toValue: heavy ? 0.9 : 0.96,
                  duration: 60,
                  useNativeDriver: true,
                }),
                Animated.timing(bossScale, { toValue: 1, duration: 160, useNativeDriver: true }),
              ]),
              ...(heavy ? [flash(stageFlash, 0.55, 300)] : []),
            ]),
          ]),
        ]);
      }
    } else {
      // 보스가 친다 — 화면(나) 쪽으로 커지며 덮쳐 왔다 물러난다
      const attack = Animated.parallel([
        swing(bossY, 26, 120, 230),
        Animated.sequence([
          Animated.timing(bossScale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
          Animated.timing(bossScale, { toValue: 1, duration: 230, useNativeDriver: true }),
        ]),
      ]);
      impact = Animated.parallel([
        attack,
        Animated.sequence([
          Animated.delay(100),
          miss
            ? swing(view, 60, 90, 220)
            : Animated.parallel([
                streak(claw, clawFade, 110),
                shake(view, heavy ? 16 : 8),
                flash(stageFlash, heavy ? 0.55 : 0.3, 280),
              ]),
        ]),
      ]);
    }

    // 숫자는 부딪히는 순간 떠서 올라가며 사라진다 — 다음 행동(0.6초 뒤) 전에 끝난다
    Animated.parallel([
      impact,
      Animated.sequence([
        Animated.delay(90),
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
    <Animated.View style={[styles.stage, { transform: [{ translateX: view }] }]}>
      <Animated.View
        style={[
          styles.boss,
          { transform: [{ translateX: bossX }, { translateY: bossY }, { scale: bossScale }] },
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

      {/* 베기 자국 — 보스 한가운데를 비스듬히. 치명타면 반대쪽으로 한 번 더 그어 X가 된다 */}
      <View pointerEvents="none" style={styles.mark}>
        <Animated.View
          style={[
            styles.slash,
            {
              backgroundColor: edge,
              opacity: slashFade,
              transform: [{ rotate: '-35deg' }, { scaleX: slash }],
            },
          ]}
        />
        {crit && (
          <Animated.View
            style={[
              styles.slash,
              {
                backgroundColor: edge,
                opacity: slashFade,
                transform: [{ rotate: '35deg' }, { scaleX: slash }],
              },
            ]}
          />
        )}
      </View>

      {/* 할퀸 자국 — 보스가 나를 칠 때 화면 위에 붉게 셋 */}
      <View pointerEvents="none" style={[styles.mark, styles.claws]}>
        {[-28, 0, 28].map((dx) => (
          <Animated.View
            key={dx}
            style={[
              styles.claw,
              {
                opacity: clawFade,
                transform: [{ translateX: dx }, { rotate: '22deg' }, { scaleY: claw }],
              },
            ]}
          />
        ))}
      </View>

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
    alignItems: 'center',
  },
  boss: { marginTop: 14, width: BOSS, height: BOSS },
  art: { width: BOSS, height: BOSS },
  over: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blank: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border,
    borderColor: colors.edge,
  },
  mark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slash: { position: 'absolute', width: SLASH, height: 6 },
  claws: { justifyContent: 'flex-end', paddingBottom: 20 },
  claw: { position: 'absolute', bottom: 24, width: 6, height: CLAW, backgroundColor: colors.hp },
  popup: { position: 'absolute', alignItems: 'center', left: 0, right: 0 },
  atBoss: { top: 50 },
  atMe: { bottom: 24 },
});
