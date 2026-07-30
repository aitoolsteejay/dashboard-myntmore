import { createFileRoute } from '@tanstack/react-router'
import { ActionablesPage } from '../components/actionables/ActionablesPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/actionables')({
  beforeLoad: requireInternalUser,
  component: ActionablesPage,
})
