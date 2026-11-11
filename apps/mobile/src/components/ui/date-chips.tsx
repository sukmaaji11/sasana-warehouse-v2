import { addDays, formatDate, MAX_BACKDATE_DAYS, todayWib } from '@sasana/shared-constants';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/theme';
import { Chips } from './chips';

/** Q16: pilih tanggal dari hari ini sampai 7 hari ke belakang — tanpa kalender, cukup satu ketuk. */
export function DateChips({ label, value, onChange }: { label: string; value: string; onChange: (d: string) => void }) {
  const today = todayWib();
  const options = Array.from({ length: MAX_BACKDATE_DAYS + 1 }, (_, i) => {
    const d = addDays(today, -i);
    return { value: d, label: i === 0 ? 'Hari ini' : i === 1 ? 'Kemarin' : formatDate(d).replace(/ \d{4}$/, '') };
  });
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Chips options={options} value={value} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text },
});
