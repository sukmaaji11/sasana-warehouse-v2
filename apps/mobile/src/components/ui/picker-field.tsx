import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, spacing, touchTarget } from '@/theme';

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
}

/** Pengganti <select> untuk mobile: tombol + daftar layar penuh dengan pencarian. */
export function PickerField({
  label,
  placeholder,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(s)) : options;
  }, [options, q]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.field, error ? { borderColor: colors.danger } : null]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.value, !selected && { color: colors.textMuted }]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup" onPress={() => setOpen(false)} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            placeholder="Cari…"
            placeholderTextColor={colors.textMuted}
            value={q}
            onChangeText={setQ}
            style={styles.search}
            autoCorrect={false}
          />
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={<Text style={styles.empty}>Tidak ada pilihan.</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.background }]}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setQ('');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.hint ? <Text style={styles.optionHint}>{item.hint}</Text> : null}
                </View>
                {item.value === value ? <MaterialCommunityIcons name="check" size={22} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text },
  field: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: { flex: 1, fontSize: font.body, color: colors.text },
  error: { fontSize: font.small, color: colors.danger },
  modal: { flex: 1, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  modalTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: font.body,
    color: colors.text,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: touchTarget },
  optionLabel: { fontSize: font.body, color: colors.text },
  optionHint: { fontSize: font.small, color: colors.textMuted },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg },
  empty: { padding: spacing.lg, color: colors.textMuted, fontSize: font.body },
});
