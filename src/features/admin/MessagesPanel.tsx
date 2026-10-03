"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { AUDIENCES, STAGES, type Audience, type Stage } from "@/lib/messages/catalog";
import { api } from "./api";
import { inputClass } from "./ui";

type Message = {
  key: string;
  stage: Stage;
  audience: Audience;
  label: string;
  when: string;
  channels: { app: boolean; email: boolean };
  allowed: { app: boolean; email: boolean };
  subject: string;
  title: string;
  body: string;
  defaults: { subject: string; title: string; body: string };
  vars: Record<string, string>;
  customized: boolean;
  preview: { subject: string; html: string };
};

const AUDIENCE_TONE: Record<Audience, "info" | "neutral" | "warning" | "ok"> = {
  client: "info",
  team: "neutral",
  inspector: "warning",
  guest: "ok",
};

/**
 * Всички съобщения на системата по хода на операцията — кой ги получава,
 * кога и как. Текстът се променя тук, без код; {{име}} се замества с данните.
 */
export default function MessagesPanel({ toast }: { toast: (text: string, tone?: "ok" | "error") => void }) {
  const [list, setList] = useState<Message[] | null>(null);
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [editing, setEditing] = useState<Message | null>(null);

  const load = () => api<Message[]>("/api/admin/messages").then((r) => r.ok && setList(r.data));
  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const shown = (list ?? []).filter((m) => audience === "all" || m.audience === audience);
    return (Object.keys(STAGES) as Stage[])
      .map((stage) => ({ stage, items: shown.filter((m) => m.stage === stage) }))
      .filter((g) => g.items.length);
  }, [list, audience]);

  if (!list) return <p className="p-4 text-sm text-muted">Зареждане…</p>;

  return (
    <div className="space-y-3">
      <Card className="space-y-2 text-sm text-ink-2">
        <p>
          Всяко събитие изпраща едно съобщение — в приложението (и push на телефона) и/или по имейл. Текстовете се
          променят тук. Сумите, данните за превод и номерата на фактури се добавят автоматично под текста.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "client", "team", "inspector", "guest"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className={`min-h-[36px] rounded-full px-3 text-sm font-semibold ${
                audience === a ? "bg-brand-primary text-white" : "bg-brand-bg text-brand-secondary"
              }`}
            >
              {a === "all" ? `Всички (${list.length})` : AUDIENCES[a]}
            </button>
          ))}
        </div>
      </Card>

      {groups.map((g) => (
        <Card key={g.stage} padding="none">
          <h3 className="border-b border-line px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-muted">{STAGES[g.stage]}</h3>
          <ul className="divide-y divide-line">
            {g.items.map((m) => (
              <li key={m.key}>
                <button onClick={() => setEditing(m)} className="flex min-h-touch w-full items-start gap-3 px-4 py-3 text-left hover:bg-brand-bg">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">{m.label}</span>
                      <Badge tone={AUDIENCE_TONE[m.audience]}>{AUDIENCES[m.audience]}</Badge>
                      {m.customized && <Badge tone="warning">Променен</Badge>}
                    </div>
                    <div className="text-xs text-muted">{m.when}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-muted">
                    <span title="В приложението" className={m.channels.app ? "text-brand-primary" : "opacity-30"}>
                      <Icon name="bell" size={16} />
                    </span>
                    <span title="Имейл" className={m.channels.email ? "text-brand-primary" : "opacity-30"}>
                      <Icon name="mail" size={16} />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {editing && (
        <MessageEditor
          message={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            toast(text);
            setEditing(null);
            load();
          }}
          onError={(text) => toast(text, "error")}
        />
      )}
    </div>
  );
}

function MessageEditor({
  message,
  onClose,
  onSaved,
  onError,
}: {
  message: Message;
  onClose: () => void;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [form, setForm] = useState({
    subject: message.subject,
    title: message.title,
    body: message.body,
    app: message.channels.app,
    email: message.channels.email,
  });
  const [preview, setPreview] = useState(message.preview);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await api<{ preview: Message["preview"] }>(`/api/admin/messages/${message.key}`, { method: "PUT", body: form });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    setPreview(res.data.preview);
    onSaved("Съобщението е запазено");
  };
  const reset = async () => {
    if (!confirm("Да върнем текста по подразбиране?")) return;
    const res = await api(`/api/admin/messages/${message.key}`, { method: "DELETE" });
    if (!res.ok) return onError(res.error);
    onSaved("Върнат е текстът по подразбиране");
  };
  const test = async () => {
    setBusy(true);
    const res = await api<{ to: string }>(`/api/admin/messages/${message.key}/test`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onSaved(`Пробният имейл е изпратен до ${res.data.to}`);
  };

  return (
    <Sheet open onClose={onClose} placement="bottom" className="mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto p-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-ink">{message.label}</h3>
            <p className="text-sm text-muted">
              {AUDIENCES[message.audience]} · {message.when}
            </p>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted" aria-label="Затвори">
            <Icon name="x" />
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {message.allowed.app && (
            <label className="flex min-h-touch items-center gap-2">
              <input type="checkbox" checked={form.app} onChange={(e) => setForm({ ...form, app: e.target.checked })} />
              В приложението и push
            </label>
          )}
          {message.allowed.email && (
            <label className="flex min-h-touch items-center gap-2">
              <input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} />
              Имейл
            </label>
          )}
        </div>

        {message.allowed.email && (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-2">Тема на имейла</span>
            <input className={inputClass} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-2">Заглавие</span>
          <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-2">Текст</span>
          <textarea
            className={`${inputClass} min-h-[110px] py-2`}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        {Object.keys(message.vars).length > 0 && (
          <p className="text-xs text-muted">
            Може да ползвате:{" "}
            {Object.entries(message.vars).map(([k, label]) => (
              <span key={k} className="mr-2 inline-block">
                <code className="rounded bg-brand-bg px-1 text-ink">{`{{${k}}}`}</code> {label}
              </span>
            ))}
          </p>
        )}

        {message.allowed.email && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-2">Как изглежда имейлът (с примерни данни)</p>
            <p className="text-sm text-ink">
              <span className="text-muted">Тема:</span> {preview.subject}
            </p>
            <iframe
              title="Преглед на имейла"
              sandbox=""
              srcDoc={preview.html}
              className="h-80 w-full rounded-card border border-line bg-white"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pb-2">
          <Button disabled={busy} onClick={save}>
            Запази
          </Button>
          {message.allowed.email && (
            <Button variant="secondary" disabled={busy} onClick={test}>
              <Icon name="mail" size={16} /> Пробен имейл до мен
            </Button>
          )}
          {message.customized && (
            <Button variant="ghost" disabled={busy} onClick={reset}>
              По подразбиране
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
