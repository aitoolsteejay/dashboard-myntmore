import { createFileRoute } from '@tanstack/react-router'
import { ClientDetailPage } from '../components/clients/ClientDetailPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/clients_/$id')({
  beforeLoad: requireInternalUser,
  component: ClientDetailPage,
})
