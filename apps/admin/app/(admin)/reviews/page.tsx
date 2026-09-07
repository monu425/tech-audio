'use client'

import * as React from 'react'
import { Check, X } from 'lucide-react'

import { getJson, postJson } from '@/lib/api'
import type { ReviewItem, PageMeta } from '@/lib/admin-types'
import { formatDateTime } from '@/lib/format'
import { useAsync, errorMessage } from '@/components/admin/use-async'
import {
  ErrorAlert,
  LoadingCard,
  PageHeader,
  StatusBadge,
  Pagination,
  useListQuery
} from '@/components/admin/primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ListResponse = { items: ReviewItem[]; meta: PageMeta }

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      <span className="text-muted-foreground">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

export default function ReviewsPage() {
  const { page, searchParams, setQuery, setPage } = useListQuery()
  const status = searchParams.get('status') ?? 'all'

  const params = new URLSearchParams()
  if (status && status !== 'all') params.set('status', status)
  params.set('page', String(page))

  const { data, loading, error, reload } = useAsync<ListResponse>(
    () => getJson(`/admin/reviews?${params.toString()}`),
    [status, page]
  )

  const moderate = async (id: string, nextStatus: string) => {
    try {
      await postJson(`/admin/reviews/${id}/moderate`, { status: nextStatus })
      reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  const statusCounts = data?.meta.statusCounts

  return (
    <>
      <PageHeader title="Reviews" description="Moderate customer product reviews." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onChange={(event) => setQuery({ status: event.target.value, page: undefined })}
          aria-label="Filter reviews"
          className="w-44"
        >
          <option value="all">All reviews</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {statusCounts
            ? Object.entries(statusCounts)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <Badge key={key} variant="secondary">
                    {key}: {count}
                  </Badge>
                ))
            : null}
        </div>
      </div>

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Review</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="max-w-[320px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Stars rating={review.rating} />
                          {review.verifiedPurchase ? (
                            <Badge variant="outline">Verified</Badge>
                          ) : null}
                        </div>
                        {review.title ? (
                          <p className="truncate font-medium">{review.title}</p>
                        ) : null}
                        {review.body ? (
                          <p className="line-clamp-2 text-muted-foreground">{review.body}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {review.product?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={review.product.imageUrl}
                            alt=""
                            className="size-8 rounded-md border object-cover"
                          />
                        ) : null}
                        <span className="line-clamp-2 max-w-[160px]">
                          {review.product?.name ?? 'Deleted product'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{review.user?.name ?? 'Customer'}</TableCell>
                    <TableCell>
                      <StatusBadge kind="review" value={review.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(review.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {review.status !== 'approved' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void moderate(review.id, 'approved')}
                          >
                            <Check /> Approve
                          </Button>
                        ) : null}
                        {review.status !== 'rejected' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void moderate(review.id, 'rejected')}
                          >
                            <X /> Reject
                          </Button>
                        ) : null}
                        {review.status === 'rejected' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void moderate(review.id, 'pending')}
                          >
                            Restore
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No reviews found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
    </>
  )
}
