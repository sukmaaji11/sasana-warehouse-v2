import { useLocalSearchParams } from 'expo-router';
import { ShipmentDetailScreen } from '@/features/shipments/shipment-detail-screen';

export default function Page() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  return <ShipmentDetailScreen id={id} created={created === '1'} />;
}
