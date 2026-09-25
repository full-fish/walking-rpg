import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { regionById } from '@/content';
import { Text } from '@/ui/Text';
import { border, colors, space } from '@/ui/theme';

/**
 * 쓸 소재를 고른다 (T17_7 검수 4차) — 강화 +6~ · 반지 교환·올리기 · 보스 버프가 같이 쓴다.
 * 그 지역 사냥터 일곱 곳의 소재를 칸마다 "이름 가진 수"로 보여주고, **누르면 하나 담는다.**
 * 더 못 담는 칸(다 담았거나, 가진 만큼 담았거나, `distinct`인데 이미 담은 곳)을 누르면 하나 뺀다.
 * `distinct`면 한 곳에서 하나씩이다(강화·반지). 보스 버프는 같은 곳 것을 여러 개 써도 된다.
 */
export function MaterialPicker({
  region,
  need,
  distinct,
  owned,
  picked,
  onChange,
}: {
  region: number;
  /** 담아야 할 개수. 보스 버프처럼 "이만큼까지"면 그 상한 */
  need: number;
  distinct: boolean;
  /** save.materials — 사냥터 id → 가진 수 */
  owned: Record<string, number>;
  picked: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const { name, fields } = regionById(region);
  const taken = (id: string) => picked.filter((x) => x === id).length;
  const press = (id: string) => {
    const n = taken(id);
    const room = picked.length < need && n < (owned[id] ?? 0) && !(distinct && n > 0);
    if (room) onChange([...picked, id]);
    else if (n > 0) {
      const at = picked.lastIndexOf(id);
      onChange(picked.filter((_, i) => i !== at));
    }
  };
  return (
    <View style={styles.box}>
      <Text size="sm" dim>
        {name} 소재 {picked.length} / {need}
        {distinct ? ' — 서로 다른 곳에서 하나씩' : ''}
      </Text>
      <View style={styles.wrap}>
        {fields.map((f) => {
          const have = owned[f.id] ?? 0;
          const n = taken(f.id);
          return (
            <Pressable
              key={f.id}
              disabled={have === 0}
              onPress={() => press(f.id)}
              style={[styles.chip, n > 0 && styles.on]}
            >
              <Text size="sm" color={n > 0 ? colors.gold : undefined} dim={have === 0}>
                {f.material.name} {n > 0 ? `${n}/` : ''}
                {have}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * 고른 소재 상태 (T17_7 검수 4차). `auto`(가진 게 많은 곳부터 고른 것)로 채워 두고 시작한다 —
 * 그냥 누르면 예전처럼 알아서 쓰고, 바꾸고 싶을 때만 칸을 누른다.
 * 쓸 개수가 바뀌면(강화 단계가 오르면) 부르는 쪽이 key를 바꿔 새로 채운다.
 */
export function usePicked(auto: readonly string[] | null) {
  return useState<string[]>(() => [...(auto ?? [])]);
}

const styles = StyleSheet.create({
  box: { gap: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    borderWidth: border,
    borderColor: colors.edge,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  on: { borderColor: colors.gold, backgroundColor: colors.panel },
});
