import { createFileRoute } from '@tanstack/react-router'
import { FinancePage } from '../components/finance/FinancePage'
import { requireAdmin } from '@/utils/routeGuards'

export const Route = createFileRoute('/finance')({
  beforeLoad: requireAdmin,
  component: FinancePage,
})
