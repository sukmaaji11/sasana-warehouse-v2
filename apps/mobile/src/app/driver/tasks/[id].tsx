import { useLocalSearchParams } from 'expo-router';
import { ShipmentDetailScreen } from '@/features/shipments/shipment-detail-screen';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShipmentDetailScreen id={id} />;
}
