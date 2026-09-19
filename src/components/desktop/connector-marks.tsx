import type { ConnectorKind } from '@/demo/types'
import { cn } from '@/lib/utils'

/** Inline brand marks; lucide dropped brand icons, so these are drawn by hand. */
export function ConnectorMark({ kind, className }: { kind: ConnectorKind; className?: string }) {
  const cls = cn('size-6 shrink-0', className)
  switch (kind) {
    case 'slack':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={cls}>
          <path fill="#E01E5A" d="M5.04 15.16a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.27 0a2.52 2.52 0 0 1 5.04 0v6.32a2.52 2.52 0 1 1-5.04 0v-6.32Z" />
          <path fill="#36C5F0" d="M8.83 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52H8.83Zm0 1.28a2.52 2.52 0 0 1 0 5.04H2.52a2.52 2.52 0 1 1 0-5.04h6.31Z" />
          <path fill="#2EB67D" d="M18.96 8.84a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.84Zm-1.28 0a2.52 2.52 0 0 1-5.04 0V2.52a2.52 2.52 0 1 1 5.04 0v6.32Z" />
          <path fill="#ECB22E" d="M15.16 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.28a2.52 2.52 0 0 1 0-5.04h6.32a2.52 2.52 0 1 1 0 5.04h-6.32Z" />
        </svg>
      )
    case 'email':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={cls}>
          <path fill="#4285F4" d="M2 6.5A1.5 1.5 0 0 1 3.5 5H5v14H3.5A1.5 1.5 0 0 1 2 17.5v-11Z" />
          <path fill="#34A853" d="M19 5h1.5A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5H19V5Z" />
          <path fill="#EA4335" d="M5 5l7 5.25L19 5v3l-7 5.25L5 8V5Z" />
          <path fill="#FBBC04" d="M19 5h1.5c.4 0 .77.16 1.04.42L19 8V5Z" />
          <path fill="#C5221F" d="M5 5H3.5c-.4 0-.77.16-1.04.42L5 8V5Z" />
        </svg>
      )
    case 'meetings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={cls}>
          <path fill="#00832D" d="M14 12l2.6 2.97 3.5 2.24.6-5.19-.6-5.08-3.57 1.97z" />
          <path fill="#0066DA" d="M2 15.5V20a1.5 1.5 0 0 0 1.5 1.5H8L9 18.5l-1-3H4.7z" />
          <path fill="#E94235" d="M8 2.5L2 8.5h6l1-3z" />
          <path fill="#2684FC" d="M2 8.5h6v7H2z" />
          <path fill="#00AC47" d="M20.7 5.06l-4.1 3.37v7.13l4.12 3.38c.62.48 1.52.04 1.52-.74V5.8c0-.79-.92-1.23-1.54-.74zM14 12v3.5H8v6h4.5A1.5 1.5 0 0 0 14 20v-5z" />
          <path fill="#FFBA00" d="M14 2.5H8v6h6z" />
          <path fill="#00832D" d="M8 8.5h6V12H8z" opacity=".001" />
          <path fill="#00AC47" d="M14 8.5h-6v7h6z" />
        </svg>
      )
  }
}
