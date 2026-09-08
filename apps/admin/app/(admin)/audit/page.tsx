'use client'

import * as React from 'react'

import { getJson } from '@/lib/api'
import type { AuditLogEntry, PageMeta } from '@/lib/admin-types'
import { formatDateTime } from '@/lib/format'
import { useAsync } from '@/components/admin/use-async'
import {
  EmptyState,
  ErrorAlert,
  LoadingCard,
  PageHeader,
  Pagination,
  useListQuery
} from '@/components/admin/primitives'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ListResponse = { items: AuditLogEntry[]; meta: PageMeta }

function MetaDetail({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {open ? 'Hide details' : 'View details'}
        </button>
        <Badge variant={entry.status >= 200 && entry.status < 300 ? 'default' : 'secondary'}>
          HTTP {entry.status}
        </Badge>
      </div>
      {open ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
          {JSON.stringify(
            {
              path: entry.path,
              method: entry.method,
              resourceId: entry.resourceId,
              meta: entry.meta
            },
            null,
            2
          )}
        </pre>
      ) : null}
    </div>
  )
}

export default function AuditLogsPage() {
  const { searchParams, page, setPage, setQuery } = useListQuery()
  const resource = searchParams.get('resource') ?? 'all'
  const action = searchParams.get('action') ?? ''

  const params = new URLSearchParams()
  if (resource && resource !== 'all') params.set('resource', resource)
  if (action.trim()) params.set('action', action.trim())
  params.set('page', String(page))

  const { data, loading, error, reload } = useAsync<ListResponse>(
    () => getJson(`/admin/audit-logs?${params.toString()}`),
    [resource, action, page]
  )

  const resourceOptions = React.useMemo(() => {
    const seen = new Set<string>()
    for (const item of data?.items ?? []) {
      if (item.resource) seen.add(item.resource)
    }
    return [...seen]
  }, [data])

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Immutable history of sensitive admin actions. Secrets are never recorded."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={resource}
          onChange={(event) => setQuery({ resource: event.target.value, page: undefined })}
          aria-label="Filter by resource"
          className="w-44"
        >
          <option value="all">All resources</option>
          {resourceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Input
          value={action}
          onChange={(event) =>
            setQuery({ action: event.target.value || undefined, page: undefined })
          }
          placeholder="Filter by action (e.g. product.update)"
          className="max-w-xs"
          aria-label="Filter by action"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1)
            reload()
          }}
          className="text-sm text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState
          title="No audit entries"
          description="State-changing admin actions will appear here once recorded."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{entry.actorName ?? '—'}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.actorRole ?? ''}
                          {entry.ip ? ` · ${entry.ip}` : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{entry.resource ?? '—'}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.resourceId ? `#${entry.resourceId.slice(0, 12)}…` : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[340px]">
                      <MetaDetail entry={entry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onChange={setPage} />
    </>
  )
}
