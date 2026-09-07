import { OrderDetailView } from '@/components/order-detail'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetailView id={id} />
}
