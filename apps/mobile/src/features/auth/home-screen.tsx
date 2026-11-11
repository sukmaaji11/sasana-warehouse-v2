import { LOCATION_TYPE_LABELS, ROLE_LABELS } from '@sasana/shared-constants';
import { StyleSheet, Text } from 'react-native';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { colors, font } from '@/theme';
import { useMyContext } from './use-my-context';

/**
 * Beranda sementara (Phase 1): sapaan, role, dan lokasi.
 * Isi dashboard per role menyusul di Phase 3–7.
 */
export function HomeScreen({ upcoming }: { upcoming: string }) {
  const { data: user } = useMyContext();
  if (!user) return null;

  return (
    <Screen title={`Halo, ${user.full_name}`} subtitle={ROLE_LABELS[user.role]}>
      {user.locations.map((l) => (
        <Card key={l.id}>
          <Text style={styles.name}>{l.name}</Text>
          <Text style={styles.muted}>
            {l.code} · {LOCATION_TYPE_LABELS[l.type]}
          </Text>
        </Card>
      ))}
      {user.locations.length === 0 && user.role !== 'DRIVER' ? (
        <Text style={styles.muted}>Belum ada lokasi yang ditugaskan. Hubungi Super Owner.</Text>
      ) : null}
      <Text style={styles.muted}>{upcoming}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: font.heading, fontWeight: '600', color: colors.text },
  muted: { fontSize: font.body, color: colors.textMuted },
});
