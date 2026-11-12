import { useLocalSearchParams } from 'expo-router';
import { ProductionDetailScreen } from '@/features/production/production-detail-screen';

export default function Page() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  return <ProductionDetailScreen id={id} created={created === '1'} />;
}
