import { createFileRoute } from '@tanstack/react-router'
import { ProcessesPage } from '../components/processes/ProcessesPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/processes')({
  beforeLoad: requireInternalUser,
  component: ProcessesPage,
})
