import { createFileRoute } from '@tanstack/react-router'
import { ClientsPage } from '../components/clients/ClientsPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/clients')({
  beforeLoad: requireInternalUser,
  component: ClientsPage,
})
