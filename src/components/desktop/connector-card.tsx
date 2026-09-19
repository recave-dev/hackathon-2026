import {
  CalendarDaysIcon,
  HashIcon,
  InboxIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UnplugIcon,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

import { ConnectorMark } from "@/components/desktop/connector-marks";
import { Pill } from "@/components/desktop/page";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { formatDateTime, plural } from "@/demo/format";
import { actions, useDemoState } from "@/demo/store";
import type { Connector, ConnectorKind, ConnectorStatus } from "@/demo/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ConnectorStatus, string> = {
  disconnected: "Niepołączony",
  connecting: "Łączenie…",
  syncing: "Import…",
  connected: "Aktywny",
  paused: "Wstrzymany",
};

const SCOPE_ICON: Record<
  ConnectorKind,
  ComponentType<{ className?: string }>
> = {
  slack: HashIcon,
  email: InboxIcon,
  meetings: CalendarDaysIcon,
};

const SCOPE_HEADING: Record<ConnectorKind, string> = {
  slack: "Kanały do odczytu",
  email: "Skrzynki i etykiety",
  meetings: "Kalendarze i spotkania",
};

/** The mocked account the consent screen signs in with. */
const MOCK_ACCOUNT: Record<ConnectorKind, { account: string; who: string }> = {
  slack: {
    account: "droker.slack.com",
    who: "Tomasz Kowalski · Właściciel workspace",
  },
  email: {
    account: "tomasz@droker.pl",
    who: "Tomasz Kowalski · Google Workspace",
  },
  meetings: {
    account: "tomasz@droker.pl",
    who: "Tomasz Kowalski · Google Workspace",
  },
};

/** How long the fake handshake and first import take, in ms. */
const HANDSHAKE_MS = 1400;
const SYNC_MS = 2200;

export const enabledCount = (c: Connector): number =>
  c.scopes.filter((s) => s.enabled).reduce((n, s) => n + s.count, 0);

export function ConnectorCard({ connector }: { connector: Connector }) {
  const [consentOpen, setConsentOpen] = useState(false);
  const now = useDemoState().now;
  const live =
    connector.status === "connected" || connector.status === "paused";
  const busy =
    connector.status === "connecting" || connector.status === "syncing";
  const ScopeIcon = SCOPE_ICON[connector.kind];

  // The mocked OAuth flow advances on timers so a reload mid-flow still completes.
  useEffect(() => {
    if (connector.status === "connecting") {
      const t = setTimeout(() => actions.startSync(connector.id), HANDSHAKE_MS);
      return () => clearTimeout(t);
    }
    if (connector.status === "syncing") {
      const first = !connector.lastSyncAt;
      const t = setTimeout(() => {
        actions.finishSync(connector.id);
        toast.add({
          type: "success",
          title: first
            ? `${connector.name} połączony`
            : `${connector.name} zsynchronizowany`,
          description: first
            ? `Zaimportowano ${enabledCount(connector).toLocaleString("pl-PL")} ${plural(enabledCount(connector), "element", "elementy", "elementów")}. Nowe źródła pojawią się w Context.`
            : "Brak nowych elementów od ostatniej synchronizacji.",
        });
      }, SYNC_MS);
      return () => clearTimeout(t);
    }
  }, [connector]);

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border bg-card p-5 transition-colors",
        live ? "border-primary/30" : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
            <ConnectorMark kind={connector.kind} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold leading-snug">
                {connector.name}
              </h2>
              <StatusPill status={connector.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {connector.provider}
            </p>
          </div>
        </div>
        {live && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">
              {connector.status === "paused" ? "Wstrzymany" : "Włączony"}
            </span>
            <Switch
              checked={connector.status === "connected"}
              onCheckedChange={(checked) =>
                actions.setConnectorPaused(connector.id, !checked)
              }
              aria-label={`${connector.name}: włączony`}
            />
          </label>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-foreground/85">
            {connector.description}
          </p>

          {connector.status === "disconnected" ? (
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Po połączeniu agent otrzyma
              </p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {connector.permissions.map((p) => (
                  <li key={p} className="flex gap-2">
                    <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <dl className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4">
              <Fact label="Konto" value={connector.account ?? "—"} />
              <Fact
                label="Zaimportowano"
                value={
                  live || connector.status === "syncing"
                    ? enabledCount(connector).toLocaleString("pl-PL")
                    : "—"
                }
                hint={
                  connector.status === "syncing"
                    ? "trwa import"
                    : plural(
                        enabledCount(connector),
                        "element",
                        "elementy",
                        "elementów",
                      )
                }
              />
              <Fact
                label="Synchronizacja"
                value={
                  connector.lastSyncAt
                    ? formatDateTime(connector.lastSyncAt)
                    : "jeszcze nie"
                }
              />
            </dl>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {SCOPE_HEADING[connector.kind]}
            </h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {connector.scopes.filter((s) => s.enabled).length}/
              {connector.scopes.length} wybrane
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {connector.scopes.map((scope) => (
              <li key={scope.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50",
                    !scope.enabled && "text-muted-foreground",
                    busy && "cursor-default opacity-70",
                  )}
                >
                  <Checkbox
                    checked={scope.enabled}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      actions.toggleConnectorScope(
                        connector.id,
                        scope.id,
                        checked === true,
                      )
                    }
                  />
                  <ScopeIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">
                      {scope.label}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {scope.hint}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {scope.count.toLocaleString("pl-PL")}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        {connector.status === "disconnected" ? (
          <>
            <span className="text-xs text-muted-foreground">
              Logowanie przez {connector.provider.split(" · ")[0]}. Nic nie
              zostanie zapisane bez Twojej zgody.
            </span>
            <Button onClick={() => setConsentOpen(true)}>
              Połącz {connector.name}
            </Button>
          </>
        ) : busy ? (
          <>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              {connector.status === "connecting"
                ? `Autoryzacja w ${connector.provider.split(" · ")[0]}…`
                : "Pierwszy import trwa zwykle kilka minut. Tu: kilka sekund."}
            </span>
            <Button variant="outline" disabled>
              {STATUS_LABEL[connector.status]}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => actions.disconnectConnector(connector.id)}
            >
              <UnplugIcon className="size-4" /> Odłącz
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={connector.status === "paused"}
              onClick={() => actions.resync(connector.id)}
            >
              <RefreshCwIcon className="size-4" /> Synchronizuj teraz
            </Button>
          </>
        )}
      </footer>

      <ConsentDialog
        connector={connector}
        open={consentOpen}
        onOpenChange={setConsentOpen}
        now={now}
      />
    </section>
  );
}

function StatusPill({ status }: { status: ConnectorStatus }) {
  const tone =
    status === "connected"
      ? "accent"
      : status === "paused"
        ? "destructive"
        : "muted";
  return (
    <Pill tone={tone} className="gap-1.5">
      {status === "connecting" || status === "syncing" ? (
        <Spinner className="size-3" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            status === "connected" && "bg-primary",
            status === "paused" && "bg-destructive",
            status === "disconnected" && "bg-muted-foreground/50",
          )}
        />
      )}
      {STATUS_LABEL[status]}
    </Pill>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-all tabular-nums">{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/** Stand-in for the provider's OAuth consent screen. */
function ConsentDialog({
  connector,
  open,
  onOpenChange,
}: {
  connector: Connector;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: string;
}) {
  const mock = MOCK_ACCOUNT[connector.kind];
  const providerName = connector.provider.split(" · ")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-theme sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background">
              <ConnectorMark kind={connector.kind} />
            </span>
            <span aria-hidden className="text-muted-foreground">
              ⇄
            </span>
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
              D
            </span>
          </div>
          <DialogTitle>Droker prosi o dostęp do {providerName}</DialogTitle>
          <DialogDescription>
            Ekran zgody dostawcy — w wersji demo symulowany. Po zatwierdzeniu
            agent połączy się i wykona pierwszy import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              TK
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">
                {mock.account}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {mock.who}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Droker będzie mógł
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {connector.permissions.map((p) => (
                <li key={p} className="flex gap-2">
                  <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Zakres można zawęzić po połączeniu: odczyt obejmie tylko{" "}
            {SCOPE_HEADING[connector.kind].toLowerCase()} zaznaczone na karcie.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            onClick={() => {
              actions.beginConnect(connector.id, mock.account);
              onOpenChange(false);
            }}
          >
            Zezwól
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
