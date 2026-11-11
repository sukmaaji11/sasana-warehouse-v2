import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { colors, font, radius, spacing, touchTarget } from '@/theme';

type Variant = 'primary' | 'outline' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
}

export function Button({ title, variant = 'primary', loading = false, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && variant === 'primary' && { backgroundColor: colors.primaryPressed },
        pressed && variant !== 'primary' && { opacity: 0.7 },
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      {loading && (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      )}
      <Text style={[styles.label, variant === 'primary' ? styles.labelOnPrimary : variant === 'danger' ? styles.labelDanger : styles.labelOutline]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.dangerSurface },
  disabled: { opacity: 0.5 },
  label: { fontSize: font.body, fontWeight: '600' },
  labelOnPrimary: { color: colors.onPrimary },
  labelOutline: { color: colors.text },
  labelDanger: { color: colors.danger },
});
