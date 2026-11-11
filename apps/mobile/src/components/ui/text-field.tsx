import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, font, radius, spacing, touchTarget } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, error, style, ref, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        accessibilityLabel={label}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: font.small, color: colors.danger },
});
