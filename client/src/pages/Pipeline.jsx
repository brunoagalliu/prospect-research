import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import Badge from '../components/Badge';

const STAGE_LABELS = {
  sourced: 'Source new companies',
  company_enrichment: 'Enrich companies',
  marketing_headcount: 'Marketing headcount',
  hiring_signals: 'Hiring signals',
  scores: 'Recompute scores',
  contacts_found: 'Find contacts',
  contact_emails: 'Enrich contact emails',
  contact_phones: 'Request contact phones',
  hubspot_sync: 'HubSpot sync',
  instantly_sync: 'Instantly sync',
};

function formatResult(result) {
  if (!result) return '—';
  if (result.error) return `Error: ${result.error}`;
  if (result.skipped) return `Skipped — ${result.skipped}`;
  const entries = Object.entries(result).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
  return entries.join(' · ') || '—';
}

function formatDuration(start, end) {
  if (!end) return 'In progress…';
  const seconds = Math.round((new Date(end) - new Date(start)) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function StatusDot({ run }) {
  const color = run.error ? 'bg-signal' : !run.finished_at ? 'bg-brand-400' : 'bg-good';
  return <span className={`h-2 w-2 flex-none rounded-full ${color}`} />;
}

export default function Pipeline() {
  const queryClient = useQueryClient();

  const { data: runs, isLoading } = useQuery({
    queryKey: ['pipeline-runs'],
    queryFn: () => api('/pipeline/runs'),
    refetchInterval: 15000,
  });

  const runMutation = useMutation({
    mutationFn: () => api('/pipeline/run', { method: 'POST', body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] }),
  });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-7 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">Pipeline</h1>
          <p className="mt-1 text-sm text-ink-500">Sourcing, enrichment, and sync — automated daily.</p>
        </div>
        <button className="btn-primary" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          {runMutation.isPending ? 'Running…' : 'Run now'}
        </button>
      </div>

      {runMutation.isError && (
        <p className="mb-4 text-sm text-signal-dark">{runMutation.error.message}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : runs?.length === 0 ? (
        <p className="text-sm text-ink-400">No runs yet.</p>
      ) : (
        <div className="space-y-4">
          {runs?.map((run) => (
            <div key={run.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <StatusDot run={run} />
                  <p className="text-sm font-semibold text-ink-900">
                    {new Date(run.started_at).toLocaleString()}
                  </p>
                </div>
                <span className="font-mono text-xs text-ink-400">{formatDuration(run.started_at, run.finished_at)}</span>
              </div>
              {run.error && (
                <p className="mb-3">
                  <Badge variant="signal">Run failed: {run.error}</Badge>
                </p>
              )}
              {run.summary ? (
                <dl className="divide-y divide-ink-50 text-sm">
                  {Object.entries(run.summary).map(([stage, result]) => (
                    <div key={stage} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                      <dt className="w-48 flex-none font-medium text-ink-700">
                        {STAGE_LABELS[stage] || stage}
                      </dt>
                      <dd className="font-mono text-xs text-ink-500 sm:text-sm">{formatResult(result)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-ink-400">Still running…</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
