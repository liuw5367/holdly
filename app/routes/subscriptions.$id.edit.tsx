import type { Route } from './+types/subscriptions.$id.edit'
import { IconCheck } from '@tabler/icons-react'
import { useRef } from 'react'
import { data, redirect, useActionData, useLoaderData, useSubmit } from 'react-router'
import { AssetForm } from '~/components/asset-form'
import { SubPageHeader } from '~/components/page-header'
import {
  getAssetById,
  getAssetWithTags,
  getCategoriesByUserId,
  getPaymentAccountsByUserId,
  getPaymentTypesByUserId,
  getTagsByUserId,
  updateAsset,
} from '~/db/queries/assets'
import { getAssetDetailPath } from '~/lib/asset-meta'
import { assetFormSchema } from '~/lib/asset.schema'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const userId = user.id
  const asset = await getAssetById(params.id, userId)
  if (!asset)
    throw new Response('Not Found', { status: 404 })

  if (asset.assetType !== 'subscription')
    throw redirect(`/assets/${asset.id}/edit`)

  const [tagIds, categories, tags, paymentTypes, paymentAccounts] = await Promise.all([
    getAssetWithTags(asset.id),
    getCategoriesByUserId(userId),
    getTagsByUserId(userId),
    getPaymentTypesByUserId(userId),
    getPaymentAccountsByUserId(userId),
  ])

  return data({ asset, tagIds, categories, tags, paymentTypes, paymentAccounts }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const raw = Object.fromEntries(formData)
  const tagIds = formData.getAll('tagIds').map(String)

  const baseData = {
    name: raw.name as string,
    emoji: (raw.emoji as string) || '📦',
    categoryId: raw.categoryId as string,
    assetType: 'subscription' as const,
    paymentTypeId: (raw.paymentTypeId as string) || undefined,
    paymentAccountId: (raw.paymentAccountId as string) || undefined,
    tagIds,
    notes: (raw.notes as string) || undefined,
    purchasePrice: undefined,
    currentValue: undefined,
    purchaseDate: (raw.purchaseDate as string) || undefined,
    subscriptionPrice: (raw.subscriptionPrice as string) || undefined,
    billingCycle: (raw.billingCycle as 'monthly' | 'quarterly' | 'yearly') || undefined,
    nextRenewalDate: undefined,
    subscriptionStartDate: (raw.subscriptionStartDate as string) || undefined,
  }

  const parsed = assetFormSchema.safeParse(baseData)
  if (!parsed.success)
    return { errors: parsed.error.flatten().fieldErrors }

  const validated = parsed.data
  const updated = await updateAsset(params.id, user.id, {
    name: validated.name,
    emoji: validated.emoji,
    categoryId: validated.categoryId,
    assetType: validated.assetType,
    paymentTypeId: validated.paymentTypeId,
    paymentAccountId: validated.paymentAccountId,
    notes: validated.notes,
    tagIds: validated.tagIds,
    purchaseDate: validated.purchaseDate,
    subscriptionPrice: validated.subscriptionPrice,
    billingCycle: validated.billingCycle,
    subscriptionStartDate: validated.subscriptionStartDate,
  })

  if (!updated)
    return data({ errors: { paymentAccountId: ['支付账户不可用，请重新选择'] } }, { status: 400, headers })

  return redirect(getAssetDetailPath({ id: params.id, assetType: 'subscription' }), { headers })
}

export default function SubscriptionsEdit() {
  const { asset, tagIds, categories, tags, paymentTypes, paymentAccounts } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const submit = useSubmit()
  const submitRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <SubPageHeader
        backTo={getAssetDetailPath(asset)}
        backLabel="返回"
        title="编辑订阅"
        primaryAction={{
          label: '保存',
          icon: IconCheck,
          onClick: () => submitRef.current?.click(),
        }}
      />
      <AssetForm
        categories={categories}
        tags={tags}
        paymentTypes={paymentTypes}
        paymentAccounts={paymentAccounts}
        mode="subscription"
        defaultValues={{
          name: asset.name,
          emoji: asset.emoji,
          categoryId: asset.categoryId || '',
          assetType: asset.assetType,
          tagIds,
          notes: asset.notes || '',
          paymentTypeId: asset.paymentTypeId || '',
          paymentAccountId: asset.paymentAccountId || '',
          purchaseDate: asset.purchaseDate || '',
          subscriptionPrice: asset.subscriptionPrice || '',
          billingCycle: asset.billingCycle || undefined,
          subscriptionStartDate: asset.subscriptionStartDate || '',
        }}
        hideHeader
        submitLabel="保存订阅"
        errors={actionData?.errors}
        onSubmit={fd => submit(fd, { method: 'post' })}
        submitRef={submitRef}
      />
    </div>
  )
}
