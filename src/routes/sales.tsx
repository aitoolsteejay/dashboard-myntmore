import { createFileRoute } from '@tanstack/react-router'
import { SalesOutreachPage } from '../components/sales/SalesPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/sales')({
  beforeLoad: requireInternalUser,
  component: SalesOutreachPage,
})
