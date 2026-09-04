import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

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
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <button className="btn-primary" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          {runMutation.isPending ? 'Running…' : 'Run now'}
        </button>
      </div>

      {runMutation.isError && (
        <p className="mb-4 text-sm text-red-600">{runMutation.error.message}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : runs?.length === 0 ? (
        <p className="text-sm text-gray-500">No runs yet.</p>
      ) : (
        <div className="space-y-4">
          {runs?.map((run) => (
            <div key={run.id} className="rounded-lg bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {new Date(run.started_at).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">{formatDuration(run.started_at, run.finished_at)}</p>
              </div>
              {run.error && (
                <p className="mb-3 text-sm text-red-600">Run failed: {run.error}</p>
              )}
              {run.summary ? (
                <dl className="divide-y divide-gray-100 text-sm">
                  {Object.entries(run.summary).map(([stage, result]) => (
                    <div key={stage} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                      <dt className="w-48 flex-none font-medium text-gray-700">
                        {STAGE_LABELS[stage] || stage}
                      </dt>
                      <dd className="text-gray-500">{formatResult(result)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-gray-500">Still running…</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
