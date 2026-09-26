import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import type { BattleEvent } from '@/game/battle';
import type { ArrowEffect, Style } from '@/game/formulas';
import { arrowFlyIcons } from '@/ui/arrowIcons';
import { monsterIcons } from '@/ui/monsterIcons';
import { SKILL_LABEL } from '@/ui/styleText';
import { Text } from '@/ui/Text';
import { border, colors, critColor, fx } from '@/ui/theme';

/** 무대 높이와 적 그림 크기 — 보스전은 크게 (T17_7 검수 4차), 사냥터는 작게 (T18) */
const SIZE = { boss: { stage: 260, art: 220 }, field: { stage: 190, art: 150 } } as const;
/** 베기 자국 길이, 할퀸 자국 길이 */
const SLASH = 250;
const CLAW = 150;
/** 한 칸에 몇 번까지 긋나 — 난무가 네 번이다 (T18) */
const CUTS = 4;
/** 한 칸 안에서 여러 번 벨 때 사이 간격 — 0.6초 안에 끝난다 */
const GAP = 110;
/** 활의 거리 (T18) — 가장 멀 때 적 크기 */
const FAR_SCALE = 0.55;

/**
 * 화살마다 모양 (T18_1, 코드로 그리기) — 색 · 굵기 · 길이 · 날아가는 시간(ms) · 궤적 · 맞는 자리 효과.
 *   곧게(straight) · 뚫고 지나감(through) · 포물선(arc). `volley`는 한 번에 겹쳐 나는 가는 줄 수
 *   burst는 맞은 자리에 터지는 색, orb는 흡혈 구슬, zap은 번개, quake는 화면 흔들림
 */
type ArrowLook = {
  color: string;
  width: number;
  length: number;
  ms: number;
  path: 'straight' | 'through' | 'arc';
  volley?: number;
  burst?: { color: string; size: number };
  orb?: boolean;
  zap?: boolean;
  quake?: number;
};
const ARROW_LOOK: Record<ArrowEffect, ArrowLook> = {
  basic: { color: colors.text, width: 4, length: 70, ms: 170, path: 'straight' },
  pierce: { color: fx.frost, width: 2, length: 120, ms: 150, path: 'through' },
  fire: {
    color: fx.fire,
    width: 5,
    length: 70,
    ms: 170,
    path: 'straight',
    burst: { color: fx.fire, size: 70 },
  },
  bomb: {
    color: fx.smoke,
    width: 10,
    length: 18,
    ms: 280,
    path: 'arc',
    burst: { color: fx.fire, size: 140 },
    quake: 10,
  },
  thin: { color: colors.text, width: 2, length: 40, ms: 110, path: 'straight', volley: 3 },
  ice: {
    color: fx.ice,
    width: 4,
    length: 70,
    ms: 170,
    path: 'straight',
    burst: { color: fx.frost, size: 80 },
  },
  vamp: { color: fx.blood, width: 4, length: 70, ms: 170, path: 'straight', orb: true },
  shock: { color: fx.spark, width: 4, length: 70, ms: 140, path: 'straight', zap: true },
  heavy: { color: colors.text, width: 9, length: 84, ms: 260, path: 'straight', quake: 12 },
};
/** 화살이 없을 때(활로 친다) — 흐린 짧은 줄 */
const NO_ARROW: ArrowLook = { color: colors.dim, width: 3, length: 40, ms: 170, path: 'straight' };
const lookOf = (e: BattleEvent) => (e.arrow ? ARROW_LOOK[e.arrow] : NO_ARROW);

/** 내 공격 한 번의 글자 — 여러 번이면 이어 붙인다 */
function hitText(e: BattleEvent): string {
  if (e.type === 'miss') return '빗나감';
  return e.type === 'crit' ? `치명타! ${e.value}` : `${e.value}`;
}

/** 이번 칸 → 무대에 뜨는 글자. 내 공격은 적 위에, 적 공격은 화면 아래(내 쪽)에 뜬다 */
function popupOf(beat: BattleEvent[], style: Style) {
  const first = beat[0];
  if (first.actor === 'monster') {
    const at = styles.atMe;
    if (first.type === 'stun')
      return { text: '기절! ✦', color: fx.spark, big: true, at: styles.atFoe };
    if (first.type === 'miss') return { text: '회피!', color: colors.wp, big: true, at };
    if (first.type === 'block') {
      const counter = beat.find((e) => e.counter);
      const text = counter ? `막음! 반격 ${hitText(counter)}` : '막음!';
      return { text, color: colors.exp, big: true, at };
    }
    const crit = first.type === 'crit';
    return {
      text: `${crit ? '치명타! ' : ''}-${first.value}`,
      color: crit ? colors.gold : colors.hp,
      big: true,
      at,
    };
  }
  const at = styles.atFoe;
  if (first.type === 'guard')
    return { text: `${SKILL_LABEL[style]}!`, color: colors.exp, big: true, at };
  const hits = beat.filter((e) => e.actor === 'player');
  const skill = first.skill ? `${SKILL_LABEL[style]}! ` : '';
  const crit = hits.some((e) => e.type === 'crit');
  const allMiss = hits.every((e) => e.type === 'miss');
  const heal = hits.reduce((n, e) => n + (e.heal ?? 0), 0);
  return {
    text: skill + hits.map(hitText).join(' · ') + (heal > 0 ? ` (HP +${heal})` : ''),
    color: allMiss ? colors.dim : crit ? colors.gold : colors.text,
    big: crit || skill !== '',
    at,
  };
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
 * 계열마다 내 공격 자국 (T18) — 각도 · 굵기 · 길이. 활은 자국 대신 화살이 날아간다(bow).
 *   한손검 한 줄 베기 · 쌍칼 번갈아 X · 대검 굵고 긴 베기 · 검과 방패 짧게 찌르기
 */
function cutShape(style: Style, i: number, crit: boolean) {
  switch (style) {
    case 'dual':
      return { rotate: i % 2 === 0 ? '-35deg' : '35deg', height: 5, width: SLASH * 0.8 };
    case 'great':
      return { rotate: '-18deg', height: crit ? 18 : 13, width: SLASH * 1.15 };
    case 'shield':
      return { rotate: '-8deg', height: 6, width: SLASH * 0.55 };
    default:
      return {
        rotate: crit && i % 2 === 1 ? '35deg' : '-35deg',
        height: crit ? 8 : 6,
        width: SLASH,
      };
  }
}

/**
 * 전투 무대 (T17_7 검수 4차 → T18) — **적만 보인다.** 나는 화면 이쪽(1인칭)이라 캐릭터 그림이 필요 없다.
 * 보스전과 사냥터가 같이 쓴다 — 사냥터는 무대가 작다. 그림이 없는 적은 이름 상자에 같은 연출을 한다.
 * **아무것도 계산하지 않는다** — 전투 화면이 재생하는 칸(`beat`)을 받아 움직이기만 한다.
 * `step`이 바뀔 때마다 한 번 움직인다(물약으로 이어 붙인 구간은 seq가 0부터 다시 세서 seq로는 못 가른다).
 *
 *   내 공격  계열마다 다른 자국(cutShape) → 적이 떨며 하얗게 번쩍인다. 연격 · 난무는 한 칸에 여러 번 긋는다
 *            활은 화살이 아래에서 날아가 꽂힌다. 치명타 자국 색은 치명 배율(`crd`)을 따른다
 *   빗나감   자국이 흐리게 지나가고 적이 옆으로 비킨다
 *   적 공격  적이 화면 쪽으로 덮쳐 오고 → 붉은 할퀸 자국 셋 · 화면이 흔들리며 붉게 번쩍인다. 숫자는 아래
 *   회피     적이 덮쳐 오는데 화면(내 시점)이 옆으로 비킨다
 *   막기     화면 아래 방패가 번쩍 — 곧바로 짧은 반격 자국 (검과 방패). 가드도 같은 방패가 선다
 *   거리     활이면 적이 다가오는 동안 작게 서 있다가 붙을 때 커진다 (event.far)
 *   화살     화살마다 색 · 궤적 · 맞는 자리가 다르다(ARROW_LOOK, T18_1). `art`가 sprite면 화살 그림이 있는 것은 그림으로 난다.
 *            얼음에 느려진 적은 파르스름하고, 폭탄 · 얼음 · 신체파괴가 건 약화는 무대 오른쪽 아래에 적는다
 */
export function Stage({
  sprite,
  name,
  crd,
  style,
  beat,
  step,
  boss,
  art: arrowArt = 'code',
}: {
  sprite: string;
  name: string;
  /** 내 치명 배율 — 치명타 자국 색을 정한다 */
  crd: number;
  style: Style;
  /** 지금 칸의 이벤트 — 연격 · 난무 · 막은 뒤 반격은 한 칸에 여럿이다 */
  beat: BattleEvent[];
  step: number;
  boss: boolean;
  /** 화살 연출 — 코드로 그린 선이냐 화살 그림이냐 (T18_1, 둘 다 보고 고른다) */
  art?: 'code' | 'sprite';
}) {
  const size = boss ? SIZE.boss : SIZE.field;
  const art = monsterIcons[sprite];
  // 움직임 값은 한 번 만들어 끝까지 쓴다 — 렌더마다 새로 만들면 움직이던 게 끊긴다
  const [foeX] = useState(() => new Animated.Value(0));
  const [foeY] = useState(() => new Animated.Value(0));
  const [foeScale] = useState(() => new Animated.Value(1));
  const [distance] = useState(() => new Animated.Value(1));
  const [foeFlash] = useState(() => new Animated.Value(0));
  const [cuts] = useState(() =>
    Array.from({ length: CUTS }, () => ({
      draw: new Animated.Value(0),
      fade: new Animated.Value(0),
    })),
  );
  const [claw] = useState(() => new Animated.Value(0));
  const [clawFade] = useState(() => new Animated.Value(0));
  const [guard] = useState(() => new Animated.Value(0));
  const [view] = useState(() => new Animated.Value(0));
  const [stageFlash] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(1));
  /** 화살이 맞은 자리에 터지는 것 · 흡혈 구슬 · 번개 (T18_1) */
  const [burst] = useState(() => new Animated.Value(0));
  const [orb] = useState(() => new Animated.Value(0));
  const [zap] = useState(() => new Animated.Value(0));
  const first = beat[0];
  const last = beat.at(-1);
  const popup = first && popupOf(beat, style);
  const hits = beat.filter((e) => e.actor === 'player' && e.type !== 'guard');
  // 무대 번쩍임 색 — 내가 치명타를 내면 하얗게, 내가 맞으면 붉게
  const tint = first?.actor === 'monster' ? colors.hp : colors.text;
  const broken = last?.state.broken ?? 0;
  const weak = last?.state.weak ?? 0;
  const chill = last?.state.chill ?? 1;
  /** 이번 칸의 화살 — 맞는 자리 효과는 첫 발 것을 쓴다 */
  const shotLook = style === 'bow' ? hits.find((e) => e.arrow && e.type !== 'miss') : undefined;
  const hitLook = shotLook && lookOf(shotLook);
  const debuff = [
    broken > 0 && '신체파괴',
    weak > 0 && `공격 −${Math.round(weak * 100)}%`,
    chill < 1 && `느려짐 ×${chill.toFixed(2)}`,
  ].filter(Boolean);

  useEffect(() => {
    if (!first) return;
    rise.setValue(0);
    // 활의 거리 — 적이 다가오는 만큼 커진다
    const reach = Animated.timing(distance, {
      toValue: 1 - (1 - FAR_SCALE) * (last?.far ?? 0),
      duration: 420,
      useNativeDriver: true,
    });

    /** 내 공격 여러 번 — 칸 안에서 GAP씩 늦게 긋는다 */
    const strikes = () =>
      Animated.parallel(
        hits.slice(0, CUTS).map((e, i) => {
          const miss = e.type === 'miss';
          const heavy = e.type === 'crit' || style === 'great';
          const cut = cuts[i];
          const look = style === 'bow' ? lookOf(e) : undefined;
          const hitFx = miss
            ? swing(foeX, -40, 110, 200)
            : Animated.parallel([
                shake(foeX, look?.quake ?? (heavy ? 18 : 9)),
                flash(foeFlash, 0.85, heavy ? 320 : 200),
                ...(e.type === 'crit' || (style === 'great' && e.skill)
                  ? [flash(stageFlash, 0.5, 280)]
                  : []),
                // 화살이 맞은 자리 (T18_1) — 한 칸에 한 번만
                ...(i === 0 && look ? arrowFx(look) : []),
              ]);
          return Animated.sequence([
            Animated.delay(i * GAP),
            Animated.parallel([
              streak(cut.draw, cut.fade, look ? look.ms : heavy ? 150 : 110, miss ? 0.4 : 1),
              Animated.sequence([Animated.delay(look ? look.ms - 20 : 80), hitFx]),
            ]),
          ]);
        }),
      );

    /** 화살 효과가 맞은 자리 — 터짐 · 흡혈 구슬 · 번개 · 화면 흔들림 (T18_1) */
    const arrowFx = (look: ArrowLook) => [
      ...(look.burst
        ? [
            Animated.sequence([
              Animated.timing(burst, { toValue: 0, duration: 0, useNativeDriver: true }),
              Animated.timing(burst, { toValue: 1, duration: 360, useNativeDriver: true }),
            ]),
          ]
        : []),
      ...(look.orb
        ? [
            Animated.sequence([
              Animated.timing(orb, { toValue: 0, duration: 0, useNativeDriver: true }),
              Animated.timing(orb, { toValue: 1, duration: 420, useNativeDriver: true }),
            ]),
          ]
        : []),
      ...(look.zap ? [flash(zap, 1, 300)] : []),
      ...(look.quake ? [shake(view, look.quake * 0.6)] : []),
    ];

    let impact: Animated.CompositeAnimation;
    if (first.actor === 'player') {
      impact =
        first.type === 'guard' ? flash(guard, 1, 520) : Animated.parallel([strikes(), reach]);
    } else if (first.type === 'stun') {
      // 번개에 맞아 쉰다 (T18_1) — 제자리에서 비틀거린다
      impact = Animated.parallel([shake(foeX, 5), flash(zap, 0.7, 400), reach]);
    } else {
      // 적이 친다 — 화면(나) 쪽으로 커지며 덮쳐 왔다 물러난다
      const attack = Animated.parallel([
        swing(foeY, 26, 120, 230),
        Animated.sequence([
          Animated.timing(foeScale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
          Animated.timing(foeScale, { toValue: 1, duration: 230, useNativeDriver: true }),
        ]),
      ]);
      const hit =
        first.type === 'miss'
          ? swing(view, 60, 90, 220)
          : first.type === 'block'
            ? Animated.parallel([
                flash(guard, 1, 320),
                Animated.sequence([Animated.delay(160), strikes()]),
              ])
            : Animated.parallel([
                streak(claw, clawFade, 110),
                shake(view, first.type === 'crit' ? 16 : 8),
                flash(stageFlash, first.type === 'crit' ? 0.55 : 0.3, 280),
              ]);
      impact = Animated.parallel([attack, reach, Animated.sequence([Animated.delay(100), hit])]);
    }

    // 숫자는 부딪히는 순간 떠서 올라가며 사라진다 — 다음 칸(0.6초 뒤) 전에 끝난다
    Animated.parallel([
      impact,
      Animated.sequence([
        Animated.delay(90),
        Animated.timing(rise, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    ]).start();
    // step이 바뀔 때만 움직인다 — 물약으로 전투를 이어 붙여도 이미 보여준 칸을 다시 움직이지 않는다.
    // beat는 step과 같이 바뀌고, 나머지는 처음 한 번 만든 움직임 값이라 바뀌지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const float = {
    opacity: rise.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] }),
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
  };
  const artSize = { width: size.art, height: size.art };

  return (
    <Animated.View
      style={[styles.stage, { height: size.stage, transform: [{ translateX: view }] }]}
    >
      <Animated.View
        style={[
          styles.foe,
          artSize,
          {
            transform: [
              { translateX: foeX },
              { translateY: foeY },
              { scale: foeScale },
              { scale: distance },
            ],
          },
        ]}
      >
        {art ? (
          <>
            <Image source={art} style={artSize} resizeMode="contain" />
            {/* 맞는 순간 하얀 실루엣을 덮는다 — 투명 배경이라 그림 모양대로 번쩍인다 */}
            <Animated.Image
              source={art}
              style={[artSize, styles.over, { tintColor: '#FFFFFF', opacity: foeFlash }]}
              resizeMode="contain"
            />
            {/* 얼음 화살에 느려진 만큼 파르스름하다 (T18_1) */}
            {chill < 1 && (
              <Image
                source={art}
                style={[artSize, styles.over, { tintColor: fx.ice, opacity: (1 - chill) * 0.8 }]}
                resizeMode="contain"
              />
            )}
          </>
        ) : (
          // 아직 그림이 없는 적 — 자리만 잡고 이름을 쓴다 (sprite-list.md)
          <View style={[artSize, styles.blank]}>
            <Text dim>{name}</Text>
            <Animated.View style={[styles.over, styles.blankFlash, { opacity: foeFlash }]} />
          </View>
        )}
      </Animated.View>

      {/* 내 공격 자국 — 계열마다 모양이 다르다. 활은 화살이 아래에서 날아간다 */}
      <View pointerEvents="none" style={styles.mark}>
        {cuts.map((cut, i) => {
          const e = hits[i];
          if (!e) return null;
          const color = e.type === 'crit' ? critColor(crd) : colors.text;
          if (style === 'bow') {
            return (
              <Shot
                key={i}
                look={lookOf(e)}
                color={e.type === 'crit' ? color : undefined}
                sprite={arrowArt === 'sprite' && e.arrow ? arrowFlyIcons[e.arrow] : undefined}
                draw={cut.draw}
                fade={cut.fade}
                x={(i - 1) * 14}
                reach={size.stage}
              />
            );
          }
          const shape = cutShape(style, i, e.type === 'crit');
          return (
            <Animated.View
              key={i}
              style={[
                styles.slash,
                {
                  width: shape.width,
                  height: shape.height,
                  backgroundColor: color,
                  opacity: cut.fade,
                  transform: [{ rotate: shape.rotate }, { scaleX: cut.draw }],
                },
              ]}
            />
          );
        })}
      </View>

      {/* 할퀸 자국 — 적이 나를 칠 때 화면 위에 붉게 셋 */}
      <View pointerEvents="none" style={[styles.mark, styles.low]}>
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

      {/* 방패 — 막을 때 · 가드를 세울 때 화면 아래에서 번쩍 (T18 검과 방패) */}
      <Animated.View pointerEvents="none" style={[styles.shield, { opacity: guard }]} />

      {/* 화살이 맞은 자리 (T18_1) — 터짐(불 · 폭탄 · 얼음) · 흡혈 구슬 · 번개 */}
      {hitLook?.burst && (
        <View pointerEvents="none" style={styles.mark}>
          <Animated.View
            style={{
              width: hitLook.burst.size,
              height: hitLook.burst.size,
              borderWidth: border * 3,
              borderColor: hitLook.burst.color,
              opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
              transform: [
                { rotate: '45deg' },
                { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.2] }) },
              ],
            }}
          />
        </View>
      )}
      {hitLook?.orb && (
        <View pointerEvents="none" style={styles.mark}>
          <Animated.View
            style={[
              styles.orb,
              {
                opacity: orb.interpolate({
                  inputRange: [0, 0.1, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: orb.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, size.stage * 0.55],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      )}
      <View pointerEvents="none" style={styles.mark}>
        {[-24, 0, 24].map((dx, k) => (
          <Animated.View
            key={dx}
            style={[
              styles.zap,
              {
                opacity: zap,
                transform: [
                  { translateX: dx },
                  { translateY: k === 1 ? -44 : -34 },
                  { rotate: k % 2 === 0 ? '30deg' : '-30deg' },
                ],
              },
            ]}
          />
        ))}
      </View>

      {debuff.length > 0 && (
        <View pointerEvents="none" style={styles.debuff}>
          <Text size="sm" color={colors.exp}>
            {debuff.join(' · ')}
          </Text>
        </View>
      )}

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

/**
 * 날아가는 화살 한 발 (T18_1). 궤적은 look.path — 곧게 적까지 · 뚫고 뒤로 · 포물선(폭탄).
 * `sprite`가 있으면 그림으로, 없으면 선으로 그린다. 가는 화살은 가는 줄 여럿이 겹쳐 난다
 */
function Shot({
  look,
  color,
  sprite,
  draw,
  fade,
  x,
  reach,
}: {
  look: ArrowLook;
  color?: string;
  sprite?: number;
  draw: Animated.Value;
  fade: Animated.Value;
  x: number;
  reach: number;
}) {
  const start = reach * 0.6;
  const y =
    look.path === 'arc'
      ? draw.interpolate({ inputRange: [0, 0.5, 1], outputRange: [start, -reach * 0.2, 0] })
      : draw.interpolate({
          inputRange: [0, 1],
          outputRange: [start, look.path === 'through' ? -reach * 0.45 : 0],
        });
  const dx =
    look.path === 'arc' ? draw.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) : 0;
  const rotate =
    look.path === 'arc'
      ? draw.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-50deg', '0deg', '50deg'] })
      : '0deg';
  // 가는 화살 그림은 한 장에 셋이 그려져 있다 — 그림이면 한 장만
  const lines = sprite ? 1 : (look.volley ?? 1);
  return (
    <>
      {Array.from({ length: lines }, (_, k) => {
        const transform = [
          { translateX: dx },
          { translateX: x + (k - (lines - 1) / 2) * 10 },
          { translateY: y },
          { translateY: k * 12 },
          { rotate },
        ];
        return sprite ? (
          <Animated.Image
            key={k}
            source={sprite}
            resizeMode="contain"
            style={[styles.flyArt, { opacity: fade, transform }]}
          />
        ) : (
          <Animated.View
            key={k}
            style={[
              styles.arrow,
              {
                width: look.width,
                height: look.length,
                backgroundColor: color ?? look.color,
                opacity: fade,
                transform,
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  stage: {
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderWidth: border,
    borderColor: colors.edge,
    alignItems: 'center',
  },
  foe: { marginTop: 14 },
  over: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blank: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border,
    borderColor: colors.edge,
  },
  blankFlash: { backgroundColor: colors.text },
  mark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slash: { position: 'absolute' },
  arrow: { position: 'absolute' },
  // 그림은 정사각형 안에 세로로 선 화살(꼬리 연기 · 불꽃까지) — 칸도 정사각형이라야 안 줄어든다
  flyArt: { position: 'absolute', width: 84, height: 84 },
  orb: { width: 14, height: 14, backgroundColor: fx.blood },
  zap: { position: 'absolute', width: 4, height: 30, backgroundColor: fx.spark },
  low: { justifyContent: 'flex-end', paddingBottom: 20 },
  claw: { position: 'absolute', bottom: 24, width: 6, height: CLAW, backgroundColor: colors.hp },
  shield: {
    position: 'absolute',
    bottom: 10,
    width: 64,
    height: 44,
    borderWidth: border * 2,
    borderColor: colors.exp,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  debuff: { position: 'absolute', bottom: 6, right: 8 },
  popup: { position: 'absolute', alignItems: 'center', left: 0, right: 0 },
  atFoe: { top: 40 },
  atMe: { bottom: 24 },
});
