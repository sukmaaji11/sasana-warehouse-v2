import { useLocalSearchParams } from 'expo-router';
import { InboundDetailScreen } from '@/features/inbound/inbound-detail-screen';

export default function Page() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  return <InboundDetailScreen id={id} created={created === '1'} />;
}
