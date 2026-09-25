import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { regionById } from '@/content';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { border, colors, space } from '@/ui/theme';

/**
 * 쓸 소재를 고른다 (T17_7 검수 4차) — 강화 +6~ · 반지 교환·올리기 · 소재 버프가 같이 쓴다.
 * 그 지역 사냥터 일곱 곳의 소재를 "이름 담은 수/가진 수"로 보여준다.
 *
 *   distinct (강화·반지)  한 곳에서 하나씩이라 칸을 누르면 담고, 다시 누르면 뺀다
 *   아니면  (소재 버프)   같은 곳 것을 여러 개 쓸 수 있어서 줄마다 [−] [+] — 누를 때마다 하나씩 (T17_7 검수 5차).
 *                          전에는 칸 하나로 "담기 → 다 차면 빼기"를 번갈아 해서 1 → 2 → 3 → 2 → 3으로 돌며 0으로 못 돌아갔다
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
  /** 담아야 할 개수. 소재 버프처럼 "이만큼까지"면 그 상한 */
  need: number;
  distinct: boolean;
  /** save.materials — 사냥터 id → 가진 수 */
  owned: Record<string, number>;
  picked: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const { name, fields } = regionById(region);
  const taken = (id: string) => picked.filter((x) => x === id).length;
  const canAdd = (id: string) =>
    picked.length < need && taken(id) < (owned[id] ?? 0) && !(distinct && taken(id) > 0);
  const add = (id: string) => onChange([...picked, id]);
  const remove = (id: string) => {
    const at = picked.lastIndexOf(id);
    onChange(picked.filter((_, i) => i !== at));
  };
  return (
    <View style={styles.box}>
      <Text size="sm" dim>
        {name} 소재 {picked.length} / {need}
        {distinct ? ' — 서로 다른 곳에서 하나씩' : ''}
      </Text>
      {distinct ? (
        <View style={styles.wrap}>
          {fields.map((f) => {
            const have = owned[f.id] ?? 0;
            const n = taken(f.id);
            return (
              <Pressable
                key={f.id}
                disabled={have === 0}
                onPress={() => (n > 0 ? remove(f.id) : canAdd(f.id) && add(f.id))}
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
      ) : (
        fields.map((f) => {
          const have = owned[f.id] ?? 0;
          const n = taken(f.id);
          return (
            <View key={f.id} style={styles.row}>
              <Text size="sm" color={n > 0 ? colors.gold : undefined} dim={have === 0}>
                {f.material.name} {n}/{have}
              </Text>
              <View style={styles.steps}>
                <Button label="−" disabled={n === 0} onPress={() => remove(f.id)} />
                <Button label="+" disabled={!canAdd(f.id)} onPress={() => add(f.id)} />
              </View>
            </View>
          );
        })
      )}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  steps: { flexDirection: 'row', gap: space.xs },
});
