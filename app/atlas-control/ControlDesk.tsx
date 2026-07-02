"use client";
import { useMemo, useState } from "react";

type Ready = { title: string; detail: string; state: string };
type OperationRun = { id: string; operation_type: string; actor_identity: string; status: string; summary?: { candidate_id?: string } | null; created_at: string };
type OperationAction = { id: string; action_type: string; target_entity_type?: string | null; target_entity_id?: string | null; lifecycle_state: string; reason?: string | null; created_at: string };
type ReviewItem = { id: string; review_type: string; candidate_id?: string | null; event_id?: string | null; priority: number; status: string; recommended_action: string };
type Ops = { runs: OperationRun[]; actions: OperationAction[] };

export default function ControlDesk({ initialReadiness, initialOps, initialReviews }: { initialReadiness: Ready; initialOps: Ops; initialReviews: ReviewItem[] }) {
  const [readiness, setReadiness] = useState(initialReadiness);
  const [ops, setOps] = useState<Ops>(initialOps);
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string>("");
  const key = useMemo(() => `candidate-intake:${crypto.randomUUID()}`, []);
  async function refresh() {
    const [status, operations, reviewItems] = await Promise.all([fetch("/api/atlas-control/status"), fetch("/api/atlas-control/operations"), fetch("/api/atlas-control/review-items")]);
    if (status.ok) setReadiness(await status.json());
    if (operations.ok) setOps(await operations.json());
    if (reviewItems.ok) setReviews((await reviewItems.json()).items ?? []);
  }
  async function submit(formData: FormData) {
    setPending(true); setResult("Submitting source-backed candidate intake…");
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/atlas-control/candidate-intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, idempotencyKey: key, confidence: payload.confidence ? Number(payload.confidence) : undefined }) });
    const body = await response.json();
    setPending(false);
    if (!response.ok) { setResult((body.errors ?? [body.error]).join(" ")); return; }
    const r = body.result;
    setResult(`Candidate ${r.candidate_id} via operation ${r.operation_run_id}: ${r.idempotent_replay ? "replayed idempotently" : r.status}.`);
    refresh();
  }
  return <div className="control-grid"><section className={`status-card ${readiness.state}`}><p className="eyebrow">Readiness</p><h2>{readiness.title}</h2><p>{readiness.detail}</p></section><section className="control-panel"><p className="eyebrow">Source-backed intake</p><h2>Single event candidate</h2><form action={submit} className="intake-form"><input name="name" placeholder="Event or festival name" required /><input name="city" placeholder="City" required /><input name="county" placeholder="County (optional)" /><input name="state" defaultValue="MI" /><input name="startDate" type="date" /><input name="endDate" type="date" /><input name="sourceName" placeholder="Official source name" required /><input name="sourceUrl" placeholder="https://official-source.example/event" required /><textarea name="sourceExcerpt" placeholder="Source excerpt / notes (optional)" /><input name="confidence" type="number" min="0" max="1" step="0.01" placeholder="Confidence 0-1" /><button disabled={pending}>{pending ? "Submitting…" : "Intake candidate"}</button></form><p className="result-text">{result || "No canonical event will be published from this action."}</p></section><section className="control-panel wide"><p className="eyebrow">Operational visibility</p><h2>Recent operation runs</h2><div className="record-list">{ops.runs.map((run)=><article key={run.id}><b>{run.operation_type}</b><span>{run.status} · {new Date(run.created_at).toLocaleString()}</span><small>Actor: {run.actor_identity}</small><small>Target: {run.summary?.candidate_id ?? "—"}</small></article>)}{!ops.runs.length && <p>No operation runs visible yet.</p>}</div><h2>Recent operation actions</h2><div className="record-list">{ops.actions.map((action)=><article key={action.id}><b>{action.action_type}</b><span>{action.lifecycle_state} · {new Date(action.created_at).toLocaleString()}</span><small>Target: {action.target_entity_type ?? "—"} {action.target_entity_id ?? ""}</small><small>Reason: {action.reason ?? "—"}</small></article>)}{!ops.actions.length && <p>No operation actions visible yet.</p>}</div><h2>Open review items</h2><div className="record-list">{reviews.map((item)=><article key={item.id}><b>{item.review_type}</b><span>{item.status} · priority {item.priority}</span><small>Target: {item.candidate_id ?? item.event_id ?? "—"}</small><small>Recommended: {item.recommended_action}</small></article>)}{!reviews.length && <p>No open review items visible.</p>}</div></section></div>;
}
