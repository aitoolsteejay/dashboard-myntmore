import { createFileRoute } from '@tanstack/react-router'
import { TJPersonalBrandPage } from '../components/tj-brand/TJBrandPage'
import { requireInternalUser } from '@/utils/routeGuards'

export const Route = createFileRoute('/tj-personal-brand')({
  beforeLoad: requireInternalUser,
  component: TJPersonalBrandPage,
})
