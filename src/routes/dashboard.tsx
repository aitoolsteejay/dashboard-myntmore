import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '../components/dashboard/DashboardPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: requireInternalUser,
  component: DashboardPage,
})
