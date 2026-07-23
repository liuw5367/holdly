import type { Route } from './+types/settings.payment-card-editor'
import { redirect } from 'react-router'

export function loader({ request, params }: Route.LoaderArgs) {
  const search = new URL(request.url).search
  return redirect((params.id
    ? `/settings/payment-accounts/${params.id}/edit`
    : '/settings/payment-accounts/new') + search)
}
