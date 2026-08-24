import { createFileRoute } from '@tanstack/react-router'
import { ClientLeaderboardPage } from '@/components/leaderboard/ClientLeaderboardPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/client-leaderboard')({
  beforeLoad: requireInternalUser,
  component: ClientLeaderboardPage,
})
