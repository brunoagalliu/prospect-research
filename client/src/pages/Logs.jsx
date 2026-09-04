import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import Badge from '../components/Badge';

const SOURCE_BADGE = {
  clay: 'brand',
  apollo: 'signal',
  hubspot: 'good',
  instantly: 'neutral',
};

const ACTION_LABELS = {
  source_companies: 'Sourced companies',
  enrich_companies: 'Enriched companies',
  marketing_headcount: 'Marketing headcount lookup',
  find_contacts: 'Found contacts',
  enrich_emails: 'Enriched emails',
  request_phones: 'Requested phone numbers',
  sync: 'Synced records',
};

function formatCost(cost, source) {
  if (!cost) return '—';
  if (source === 'clay' && cost.quota_remaining != null) {
    return `${cost.quota_used_to_date?.toLocaleString()} used to date · ${cost.quota_remaining?.toLocaleString()} remaining`;
  }
  if (cost.credits_consumed != null) {
    return `${cost.credits_consumed} credit${cost.credits_consumed === 1 ? '' : 's'}`;
  }
  return '—';
}

export default function Logs() {
  const { data: summary } = useQuery({
    queryKey: ['activity-summary'],
    queryFn: () => api('/activity/summary'),
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api('/activity?limit=150'),
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">Logs</h1>
        <p className="mt-1 text-sm text-ink-500">Imports, enrichment, and sync activity — with real cost where the provider reports one.</p>
      </div>

      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.breakdown.map((b) => (
            <div key={`${b.source}:${b.action}`} className="card p-4">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Badge variant={SOURCE_BADGE[b.source] || 'neutral'}>{b.source}</Badge>
              </div>
              <p className="text-xs text-ink-500">{ACTION_LABELS[b.action] || b.action}</p>
              <p className="mt-1 font-mono text-xl font-bold text-ink-900">{b.total_count.toLocaleString()}</p>
              {b.has_credits && (
                <p className="mt-0.5 font-mono text-xs text-ink-400">{b.total_credits} credits total</p>
              )}
            </div>
          ))}
          {summary.clay_quota && (
            <div className="card p-4">
              <Badge variant="brand">clay</Badge>
              <p className="mt-1.5 text-xs text-ink-500">Search quota</p>
              <p className="mt-1 font-mono text-sm font-bold text-ink-900">
                {summary.clay_quota.quota_remaining.toLocaleString()} remaining
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-400">
                {summary.clay_quota.quota_used_to_date.toLocaleString()} used to date
              </p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : entries?.length === 0 ? (
        <p className="text-sm text-ink-400">No activity logged yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Count</th>
                <th className="px-4 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {entries?.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={SOURCE_BADGE[e.source] || 'neutral'}>{e.source}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{ACTION_LABELS[e.action] || e.action}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-ink-900">{e.count ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-500">{formatCost(e.cost, e.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
