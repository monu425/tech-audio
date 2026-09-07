import { SessionProvider } from '@/lib/session'
import { AdminShell } from '@/components/admin/shell'

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  )
}
