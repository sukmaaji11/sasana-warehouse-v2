import { StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { colors, font } from '@/theme';
import { useMyContext } from './use-my-context';
import { useSignOut } from './use-sign-out';

/** Ditampilkan jika akun nonaktif atau profil belum dibuat. */
export function BlockedScreen() {
  const { data } = useMyContext();
  const signOut = useSignOut();
  const inactive = data && !data.is_active;

  return (
    <Screen title={inactive ? 'Akun nonaktif' : 'Profil belum dibuat'}>
      <Card>
        <Text style={styles.text}>
          {inactive
            ? 'Akun Anda dinonaktifkan. Hubungi Super Owner.'
            : 'Akun ini belum memiliki profil. Hubungi Super Owner.'}
        </Text>
      </Card>
      <Button title="Keluar" variant="outline" onPress={() => signOut.mutate()} loading={signOut.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: font.body, color: colors.text },
});
