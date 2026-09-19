import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { border, colors, space } from './theme';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'normal' | 'gold';
};

/** 픽셀 버튼. 누르면 2px 내려가 눌린 느낌만 준다(애니메이션 없음). */
export function Button({ label, onPress, disabled, tone = 'normal' }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.wrap}>
      {({ pressed }) => (
        <View
          style={[
            styles.box,
            tone === 'gold' && styles.gold,
            disabled && styles.disabled,
            pressed && !disabled && styles.pressed,
          ]}
        >
          <Text color={disabled ? colors.dim : tone === 'gold' ? colors.bg : colors.text}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  box: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: colors.panel,
    borderWidth: border,
    borderColor: colors.edgeLit,
    borderBottomWidth: border * 2,
  },
  gold: { backgroundColor: colors.gold, borderColor: colors.text },
  disabled: { backgroundColor: colors.bg, borderColor: colors.edge },
  pressed: { borderBottomWidth: border, marginTop: border },
});
