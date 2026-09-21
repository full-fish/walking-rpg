import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { border, colors, space } from './theme';

type Props = {
  label: string;
  value: number;
  max: number;
  color?: string;
};

/** HP/WP/EXP 공용 게이지. 칸 없이 단순 채움. */
export function Bar({ label, value, max, color = colors.wp }: Props) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text size="sm" dim>
          {label}
        </Text>
        <Text size="sm">
          {Math.floor(value)} / {max}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  track: {
    height: space.md,
    backgroundColor: colors.bg,
    borderWidth: border,
    borderColor: colors.edge,
  },
  fill: { height: '100%' },
});
