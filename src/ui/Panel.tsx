import { StyleSheet, View, type ViewProps } from 'react-native';

import { Text } from './Text';
import { border, colors, space } from './theme';

type Props = ViewProps & { title?: string };

/** 테두리 있는 픽셀 패널. 제목을 주면 상단에 라벨이 붙는다. */
export function Panel({ title, children, style, ...rest }: Props) {
  return (
    <View style={[styles.box, style]} {...rest}>
      {title ? (
        <Text size="sm" dim style={styles.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.panel,
    borderWidth: border,
    borderColor: colors.edge,
    padding: space.md,
    gap: space.sm,
  },
  title: { letterSpacing: 1 },
});
