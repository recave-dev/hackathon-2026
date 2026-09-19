export type Id = string

export interface Person {
  id: Id
  name: string
  role: string
  company?: string
}

export interface Project {
  id: Id
  name: string
  client?: string
}

export type SourceKind = 'email' | 'document' | 'transcript' | 'slack' | 'kpi' | 'meeting'

export interface Source {
  id: Id
  kind: SourceKind
  title: string
  excerpt: string
  date: string
  author?: string
  /** Set for transcript sources: which saved note and segment the excerpt comes from. */
  noteId?: Id
  segmentId?: Id
}

export type DecisionStatus = 'pending' | 'snoozed' | 'decided' | 'delegated' | 'completed'

export interface Consequences {
  time?: string
  cost?: string
  risk?: string
}

export interface DecisionOption {
  id: Id
  label: string
  description: string
  consequences: Consequences
  /** Marks options whose outcome depends on someone outside the company. */
  requiresConsent?: string
  /** Steps the agent will simulate right after approval. */
  execution: Omit<ExecutionStep, 'id'>[]
}

export type ExecutionStatus = 'done' | 'waiting'

export interface ExecutionStep {
  id: Id
  label: string
  status: ExecutionStatus
}

export interface Question {
  id: Id
  text: string
  toId: Id
  askedAt: string
  answer?: string
  answeredAt?: string
}

export interface Outcome {
  metric: string
  forecast: string
  actual: string
  measuredAt: string
  lesson: string
}

export interface Decision {
  id: Id
  title: string
  projectId: Id
  why: string
  dueAt: string
  status: DecisionStatus
  createdAt: string
  context: string[]
  facts: string[]
  unknowns: string[]
  assumptions: string[]
  options: DecisionOption[]
  sourceIds: Id[]
  agentPlan: string
  questions: Question[]
  execution: ExecutionStep[]
  snoozedUntil?: string
  delegatedToId?: Id
  chosenOptionId?: Id
  customInstruction?: string
  decidedAt?: string
  rationale?: string
  outcome?: Outcome
  originNoteId?: Id
}

export interface Task {
  id: Id
  title: string
  ownerId: Id
  dueAt: string
  status: 'open' | 'done'
  projectId?: Id
  noteId?: Id
}

export type EntityLink =
  | { type: 'decision'; id: Id }
  | { type: 'decisions'; filter?: 'pending' | 'snoozed' | 'history' }
  | { type: 'meeting'; id: Id }
  | { type: 'note'; id: Id }
  | { type: 'session' }

export interface Activity {
  id: Id
  at: string
  text: string
  actor: 'agent' | 'user' | 'system'
  link?: EntityLink
}

export interface Change {
  id: Id
  text: string
  detail: string
  at: string
  link?: EntityLink
}

export interface Meeting {
  id: Id
  title: string
  at: string
  projectId: Id
  participantIds: Id[]
  goal: string
  priorAgreements: string[]
  openIssues: string[]
  sourceIds: Id[]
}

export interface TranscriptSegment {
  id: Id
  /** Seconds from the start of the recording. */
  at: number
  text: string
}

export type ExtractedKind = 'agreement' | 'proposal' | 'task' | 'decision' | 'missing'

export interface ExtractedItem {
  id: Id
  kind: ExtractedKind
  text: string
  segmentId: Id
  included: boolean
  /** Hint shown next to the item, e.g. that a client still has to confirm. */
  note?: string
}

export type SessionMode = 'note' | 'meeting'
export type SessionPhase = 'idle' | 'recording' | 'paused' | 'processing' | 'review' | 'saved'

export interface SessionState {
  id: Id
  mode: SessionMode
  phase: SessionPhase
  elapsedSec: number
  /** How many transcript segments have been revealed so far. */
  revealed: number
  summary: string
  items: ExtractedItem[]
  savedNoteId?: Id
}

export interface Note {
  id: Id
  sessionId: Id
  mode: SessionMode
  visibility: 'private' | 'shared'
  createdAt: string
  durationSec: number
  projectId?: Id
  summary: string
  segments: TranscriptSegment[]
  items: ExtractedItem[]
  decisionIds: Id[]
  taskIds: Id[]
}

export type ContextCategory = 'tool' | 'vendor' | 'project'

/** Who does what for a topic, e.g. approves spend or owns the subscription. */
export interface ContextRole {
  label: string
  personId: Id
  note: string
}

export interface Invoice {
  id: Id
  number: string
  date: string
  amount: number
  seats: number
  sourceId: Id
}

export interface ContextSpend {
  currency: string
  /** Current recurring charge and what it buys. */
  monthly: number
  seats: number
  /** Spending cap set by the approver. */
  cap: number
  invoices: Invoice[]
}

export type ContextEventKind = 'approved' | 'rejected' | 'note'

export interface ContextEvent {
  id: Id
  at: string
  kind: ContextEventKind
  title: string
  detail: string
  /** Who requested or decided. */
  personId?: Id
  /** Monthly amount the request was about. */
  amount?: number
  /** True for requests about a different product that share the approver or channel. */
  related?: boolean
  sourceId?: Id
}

/** A company-knowledge topic: what a thing costs, who owns it and where that is written. */
export interface ContextTopic {
  id: Id
  title: string
  subtitle: string
  category: ContextCategory
  /** The question the topic answers, in the CEO's words. */
  question: string
  answer: string
  roles: ContextRole[]
  spend?: ContextSpend
  events: ContextEvent[]
  openItems: string[]
  relatedDecisionIds: Id[]
  sourceIds: Id[]
  updatedAt: string
}

export type ConnectorKind = 'slack' | 'email' | 'meetings'

/** Lifecycle of a mocked integration: OAuth → first sync → live. */
export type ConnectorStatus = 'disconnected' | 'connecting' | 'syncing' | 'connected' | 'paused'

/** A channel, mailbox label or calendar the connector may read. */
export interface ConnectorScope {
  id: Id
  label: string
  hint: string
  /** How many items a sync of this scope brings in. */
  count: number
  enabled: boolean
}

export interface Connector {
  id: Id
  kind: ConnectorKind
  name: string
  provider: string
  description: string
  status: ConnectorStatus
  /** Workspace, mailbox or Google account once connected. */
  account?: string
  connectedAt?: string
  lastSyncAt?: string
  scopes: ConnectorScope[]
  /** What the mocked consent screen asks for. */
  permissions: string[]
}

export interface DemoState {
  version: number
  now: string
  userId: Id
  people: Person[]
  projects: Project[]
  sources: Source[]
  decisions: Decision[]
  tasks: Task[]
  activities: Activity[]
  changes: Change[]
  meetings: Meeting[]
  contexts: ContextTopic[]
  connectors: Connector[]
  notes: Note[]
  session: SessionState
}
