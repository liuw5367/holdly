import type { Route } from './+types/assets.$id.edit'
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
import { getAssetDetailPath, getAssetEditPath } from '~/lib/asset-meta'
import { assetFormSchema } from '~/lib/asset.schema'
import { createSupabaseServerClient } from '~/lib/supabase.server'

type FormMode = 'asset' | 'subscription'

function getModeFromPath(pathname: string): FormMode {
  return pathname.startsWith('/subscriptions') ? 'subscription' : 'asset'
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const userId = user.id
  const assetId = params.id

  const asset = await getAssetById(assetId, userId)
  if (!asset)
    throw new Response('Not Found', { status: 404 })

  const [tagIds, categories, tags, paymentTypes, paymentAccounts] = await Promise.all([
    getAssetWithTags(assetId),
    getCategoriesByUserId(userId),
    getTagsByUserId(userId),
    getPaymentTypesByUserId(userId),
    getPaymentAccountsByUserId(userId),
  ])

  const mode = getModeFromPath(new URL(request.url).pathname)
  const expectedMode: FormMode = asset.assetType === 'subscription' ? 'subscription' : 'asset'
  if (mode !== expectedMode)
    throw redirect(getAssetEditPath(asset))

  return data({ asset, tagIds, categories, tags, paymentTypes, paymentAccounts, mode }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const mode = getModeFromPath(new URL(request.url).pathname)
  const formData = await request.formData()
  const raw = Object.fromEntries(formData)
  const tagIds = formData.getAll('tagIds').map(String)
  const assetType = mode === 'subscription' ? 'subscription' : 'one_time'

  const baseData = {
    name: raw.name as string,
    emoji: (raw.emoji as string) || '📦',
    categoryId: raw.categoryId as string,
    assetType,
    paymentTypeId: (raw.paymentTypeId as string) || undefined,
    paymentAccountId: (raw.paymentAccountId as string) || undefined,
    tagIds,
    notes: (raw.notes as string) || undefined,
    purchasePrice: (raw.purchasePrice as string) || undefined,
    currentValue: (raw.currentValue as string) || undefined,
    purchaseDate: (raw.purchaseDate as string) || undefined,
    purchaseReceipt: (raw.purchaseReceipt as string) || undefined,
    subscriptionPrice: (raw.subscriptionPrice as string) || undefined,
    billingCycle: (raw.billingCycle as 'monthly' | 'quarterly' | 'yearly') || undefined,
    nextRenewalDate: (raw.nextRenewalDate as string) || undefined,
    subscriptionStartDate: (raw.subscriptionStartDate as string) || undefined,
  }

  const parsed = assetFormSchema.safeParse(baseData)
  if (!parsed.success)
    return data({ errors: parsed.error.flatten().fieldErrors }, { headers })

  const validated = parsed.data
  await updateAsset(params.id, user.id, {
    name: validated.name,
    emoji: validated.emoji,
    categoryId: validated.categoryId,
    assetType: validated.assetType,
    paymentTypeId: validated.paymentTypeId,
    paymentAccountId: validated.paymentAccountId,
    notes: validated.notes,
    tagIds: validated.tagIds,
    purchasePrice: validated.purchasePrice,
    currentValue: validated.currentValue,
    purchaseDate: validated.purchaseDate,
    purchaseReceipt: validated.purchaseReceipt,
    subscriptionPrice: validated.subscriptionPrice,
    billingCycle: validated.billingCycle,
    nextRenewalDate: validated.nextRenewalDate,
    subscriptionStartDate: validated.subscriptionStartDate,
  })

  return redirect(getAssetDetailPath({ id: params.id, assetType: validated.assetType }), { headers })
}

export default function AssetsEdit() {
  const { asset, tagIds, categories, tags, paymentTypes, paymentAccounts, mode } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const submit = useSubmit()
  const submitRef = useRef<HTMLButtonElement>(null)

  const isSubscription = mode === 'subscription'

  return (
    <div>
      <SubPageHeader
        backTo={getAssetDetailPath(asset)}
        backLabel="返回"
        title={isSubscription ? '编辑订阅' : '编辑资产'}
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
        mode={mode}
        defaultValues={{
          name: asset.name,
          emoji: asset.emoji,
          categoryId: asset.categoryId || '',
          assetType: asset.assetType,
          tagIds,
          notes: asset.notes || '',
          paymentTypeId: asset.paymentTypeId || '',
          paymentAccountId: asset.paymentAccountId || '',
          purchasePrice: asset.purchasePrice || '',
          currentValue: asset.currentValue || '',
          purchaseDate: asset.purchaseDate || '',
          purchaseReceipt: asset.purchaseReceipt || '',
          subscriptionPrice: asset.subscriptionPrice || '',
          billingCycle: asset.billingCycle || undefined,
          nextRenewalDate: asset.nextRenewalDate || '',
          subscriptionStartDate: asset.subscriptionStartDate || '',
        }}
        hideHeader
        submitLabel={isSubscription ? '保存订阅' : '保存资产'}
        errors={actionData?.errors}
        onSubmit={fd => submit(fd, { method: 'post' })}
        submitRef={submitRef}
      />
    </div>
  )
}
