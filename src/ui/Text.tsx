import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { colors, font } from './theme';

type Props = TextProps & { size?: keyof typeof font; dim?: boolean; color?: string };

/** 도트 폰트가 기본으로 적용된 Text. 화면에서는 이걸 쓴다. */
export function Text({ size = 'md', dim, color, style, ...rest }: Props) {
  return (
    <RNText
      style={[
        styles.base,
        { fontSize: font[size] as number, color: color ?? (dim ? colors.dim : colors.text) },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { fontFamily: font.family },
});
