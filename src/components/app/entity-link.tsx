import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import type { EntityLink as EntityLinkTarget } from '@/demo/types'

type Props = {
  link: EntityLinkTarget
  className?: string
  children: ReactNode
}

/** Resolves a serialisable entity reference (stored in demo state) to a typed router link. */
export function EntityLink({ link, className, children }: Props) {
  switch (link.type) {
    case 'decision':
      return (
        <Link to="/app/decisions/$decisionId" params={{ decisionId: link.id }} className={className}>
          {children}
        </Link>
      )
    case 'decisions':
      return (
        <Link to="/app/decisions" search={link.filter ? { filter: link.filter } : {}} className={className}>
          {children}
        </Link>
      )
    case 'meeting':
      return (
        <Link to="/app/meetings/$meetingId" params={{ meetingId: link.id }} className={className}>
          {children}
        </Link>
      )
    case 'note':
      return (
        <Link to="/app/notes/$noteId" params={{ noteId: link.id }} className={className}>
          {children}
        </Link>
      )
    case 'session':
      return (
        <Link to="/app/session" className={className}>
          {children}
        </Link>
      )
  }
}
