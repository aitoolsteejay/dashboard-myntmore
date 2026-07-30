import { createFileRoute } from '@tanstack/react-router'
import { MMContentPage } from '../components/mm/MMContentPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/mm-content')({
  beforeLoad: requireInternalUser,
  component: MMContentPage,
})
