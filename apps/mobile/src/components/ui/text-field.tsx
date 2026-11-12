import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, font, radius, spacing, touchTarget } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  /** Ikon di kiri kolom */
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Elemen di kanan kolom (mis. tombol tampilkan password) */
  right?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, error, hint, icon, right, style, ref, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        {icon ? <MaterialCommunityIcons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          accessibilityLabel={label}
          onFocus={(e) => (setFocused(true), onFocus?.(e))}
          onBlur={(e) => (setFocused(false), onBlur?.(e))}
          {...rest}
        />
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text },
  box: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  boxFocused: { borderColor: colors.primary, borderWidth: 1.5 },
  boxError: { borderColor: colors.danger },
  input: { flex: 1, minHeight: touchTarget - 2, fontSize: font.body, color: colors.text, paddingVertical: 0 },
  error: { fontSize: font.small, color: colors.danger },
  hint: { fontSize: font.small, color: colors.textMuted },
});
