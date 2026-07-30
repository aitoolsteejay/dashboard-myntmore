import { createFileRoute } from '@tanstack/react-router'
import { FinancePage } from '../components/finance/FinancePage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/finance')({
  beforeLoad: requireInternalUser,
  component: FinancePage,
})
