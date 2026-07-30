import { createFileRoute } from '@tanstack/react-router'
import { MonthlyProgressPage } from '../components/monthly/MonthlyProgressPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/monthly-targets')({
  beforeLoad: requireInternalUser,
  component: MonthlyProgressPage,
})
