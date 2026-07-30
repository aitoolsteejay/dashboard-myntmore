import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '../components/reports/ReportsPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/reports')({
  beforeLoad: requireInternalUser,
  component: ReportsPage,
})
