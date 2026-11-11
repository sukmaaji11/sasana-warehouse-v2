import { LOCATION_TYPE_LABELS, ROLE_LABELS } from '@sasana/shared-constants';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { colors, font, spacing } from '@/theme';
import { useMyContext } from './use-my-context';
import { useConfirmSignOut } from './use-sign-out';

export function ProfileScreen() {
  const { data: user } = useMyContext();
  const signOut = useConfirmSignOut();
  if (!user) return null;

  return (
    <Screen title="Profil">
      <Card>
        <Row label="Nama" value={user.full_name} />
        <Row label="Username" value={user.username} />
        <Row label="Role" value={ROLE_LABELS[user.role]} />
      </Card>
      <Card>
        <Text style={styles.section}>Lokasi</Text>
        {user.locations.length === 0 ? (
          <Text style={styles.muted}>Belum ada lokasi yang ditugaskan.</Text>
        ) : (
          user.locations.map((l) => (
            <Text key={l.id} style={styles.value}>
              {l.name} <Text style={styles.muted}>· {LOCATION_TYPE_LABELS[l.type]}</Text>
            </Text>
          ))
        )}
      </Card>
      <Button title="Keluar" variant="danger" onPress={signOut.confirm} loading={signOut.isPending} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  section: { fontSize: font.small, fontWeight: '600', color: colors.textMuted },
  muted: { fontSize: font.body, color: colors.textMuted },
  value: { fontSize: font.body, color: colors.text, fontWeight: '500' },
});
