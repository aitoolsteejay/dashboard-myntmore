import { createFileRoute } from '@tanstack/react-router'
import { HighScoresPage } from '@/components/high-scores/HighScoresPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/high-scores')({
  beforeLoad: requireInternalUser,
  component: HighScoresPage,
})
