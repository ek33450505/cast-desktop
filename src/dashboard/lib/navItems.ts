import {
  Home,
  History,
  BarChart2,
  Users,
  Layers,
  ScrollText,
  Settings,
  FileText,
  Code2,
  FolderOpen,
  Database,
  Clock,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavItem {
  label: string
  path: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Terminal', path: '/', icon: Home },
  { label: 'Open Editor', path: '/editor', icon: Code2 },
  { label: 'DB Browser', path: '/db', icon: Database },
  { label: '~/.claude/ Vault', path: '/claude', icon: FolderOpen },
  { label: 'Sessions', path: '/sessions', icon: History },
  { label: 'Analytics', path: '/analytics', icon: BarChart2 },
  { label: 'Agents', path: '/agents', icon: Users },
  { label: 'Reliability', path: '/agents/reliability', icon: ShieldAlert },
  { label: 'Hook Failures', path: '/hook-failures', icon: AlertTriangle },
  { label: 'Routines', path: '/routines', icon: Clock },
  { label: 'Swarm', path: '/swarm', icon: Layers },
  { label: 'Work Log', path: '/work-log', icon: ScrollText },
  { label: 'System', path: '/system', icon: Settings },
  { label: 'Docs', path: '/docs', icon: FileText },
]
