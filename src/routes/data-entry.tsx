import { createFileRoute } from '@tanstack/react-router'
import { DataEntryHub } from '../components/data-entry/DataEntryHub'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/data-entry')({
  beforeLoad: requireInternalUser,
  component: DataEntryHub,
})
