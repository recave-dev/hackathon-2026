import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { addDays, formatDue, parseLocal, toLocalIso } from '@/demo/format'
import { DELEGATE_IDS } from '@/demo/seed'
import { actions, useDemoState } from '@/demo/store'
import type { Decision } from '@/demo/types'
import { cn } from '@/lib/utils'

type DialogProps = {
  decision: Decision
  open: boolean
  onOpenChange: (open: boolean) => void
}

const morningOf = (iso: string): string => {
  const d = parseLocal(iso)
  d.setHours(9, 0, 0, 0)
  return toLocalIso(d)
}

export function SnoozeDialog({ decision, open, onOpenChange }: DialogProps) {
  const now = useDemoState().now
  const presets = [
    { label: 'Jutro rano', value: morningOf(addDays(now, 1)) },
    { label: 'Za 3 dni', value: morningOf(addDays(now, 3)) },
    { label: 'Za tydzień', value: morningOf(addDays(now, 7)) },
  ]
  const [choice, setChoice] = useState(presets[0].value)
  const [custom, setCustom] = useState('')
  const until = custom ? `${custom}T09:00:00` : choice
  const valid = parseLocal(until).getTime() > parseLocal(now).getTime()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Odłóż sprawę</DialogTitle>
          <DialogDescription>Sprawa wróci do kolejki w wybranym terminie. Nic nie zostanie zatwierdzone.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Termin" className="grid grid-cols-3 gap-2">
            {presets.map((p) => {
              const active = !custom && choice === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setCustom('')
                    setChoice(p.value)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    active ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted',
                  )}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground">{formatDue(p.value, now)}</span>
                </button>
              )
            })}
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Albo wybierz datę
            <Input type="date" value={custom} min={addDays(now, 1).slice(0, 10)} onChange={(e) => setCustom(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              actions.snoozeDecision(decision.id, until)
              onOpenChange(false)
              toast.add({ type: 'info', title: 'Sprawa odłożona', description: `Wróci ${formatDue(until, now)}.` })
            }}
          >
            Odłóż
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DelegateDialog({ decision, open, onOpenChange }: DialogProps) {
  const people = useDemoState().people.filter((p) => DELEGATE_IDS.includes(p.id))
  const [personId, setPersonId] = useState('')
  const [instruction, setInstruction] = useState('')
  const person = people.find((p) => p.id === personId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deleguj decyzję</DialogTitle>
          <DialogDescription>Wybrana osoba otrzyma sprawę z kontekstem i źródłami. Sprawa trafi do Historii jako delegowana.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Osoba
            <NativeSelect className="w-full" value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Osoba">
              <NativeSelectOption value="">Wybierz osobę…</NativeSelectOption>
              {people.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name} — {p.role}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Wskazówka (opcjonalnie)
            <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Np. trzymaj się budżetu, wróć do mnie tylko przy odchyleniu." className="min-h-14" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            disabled={!person}
            onClick={() => {
              if (!person) return
              actions.delegateDecision(decision.id, person.id, instruction)
              onOpenChange(false)
              toast.add({ type: 'success', title: `Delegowano · ${person.name}`, description: 'Sprawa jest w Historii, realizacja czeka na decyzję tej osoby.' })
            }}
          >
            Deleguj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AskDialog({ decision, open, onOpenChange }: DialogProps) {
  const people = useDemoState().people.filter((p) => DELEGATE_IDS.includes(p.id))
  const [personId, setPersonId] = useState(people[0]?.id ?? '')
  const [text, setText] = useState('')
  const person = people.find((p) => p.id === personId)
  const valid = Boolean(person) && text.trim().length > 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dopytaj</DialogTitle>
          <DialogDescription>Pytanie trafi do wybranej osoby. Sprawa zostaje w kolejce, odpowiedź pojawi się przy niej.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Do kogo
            <NativeSelect className="w-full" value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Adresat pytania">
              {people.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name} — {p.role}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Pytanie
            <Textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Np. ${decision.unknowns[0] ?? 'Czego jeszcze nie wiemy?'}`}
              className="min-h-16"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (!person) return
              actions.askQuestion(decision.id, person.id, text)
              setText('')
              onOpenChange(false)
              toast.add({ type: 'info', title: `Pytanie wysłane · ${person.name}`, description: 'Odpowiedź (symulowana) pojawi się za chwilę.' })
            }}
          >
            Wyślij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
