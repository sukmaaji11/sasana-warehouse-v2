import { useLocalSearchParams } from 'expo-router';
import { DistributionDetailScreen } from '@/features/distribution/distribution-detail-screen';

export default function Page() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  return <DistributionDetailScreen id={id} created={created === '1'} />;
}
