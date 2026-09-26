import { useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';

import { NAME } from '@/game/formulas';
import { nameError } from '@/game/progression';
import { trades, usePlayer } from '@/stores/usePlayer';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { border, colors, font, space } from '@/ui/theme';

/**
 * 닉네임 정하기 (T18 확인) — 이름이 비어 있으면 다른 화면 위를 덮는다. 처음 켤 때와, 이름이 없던 예전 세이브(v13 이하)에서 뜬다.
 * 규칙(2~8자 · 한글 · 영문 · 숫자)은 progression.nameError가 정한다. 닫는 길은 이름을 정하는 것뿐이다.
 */
export function NameGate() {
  const named = usePlayer((s) => s.save.player.name !== '');
  const trade = usePlayer((s) => s.trade);
  const [name, setName] = useState('');
  if (named) return null;

  const error = name === '' ? null : nameError(name);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <Panel title="모험가의 이름">
          <Text size="sm" dim>
            캐릭터 탭 제목(Lv 1 이름)에 보입니다. 한글 · 영문 · 숫자 {NAME.min}~{NAME.max}자.
          </Text>
          <TextInput
            value={name}
            onChangeText={(t) => setName(t.trim())}
            maxLength={NAME.max}
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="이름"
            placeholderTextColor={colors.dim}
            style={styles.input}
          />
          {error && (
            <Text size="sm" color={colors.hp}>
              {error}
            </Text>
          )}
          <Button
            label="시작"
            tone="gold"
            disabled={name === '' || error !== null}
            onPress={() => trade(trades.setName(name))}
          />
        </Panel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  input: {
    fontFamily: font.family,
    fontSize: font.lg as number,
    color: colors.text,
    borderWidth: border,
    borderColor: colors.edge,
    backgroundColor: colors.bg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
