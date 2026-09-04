import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useSort } from '../lib/sort';
import SortableHeader from '../components/SortableHeader';
import Badge from '../components/Badge';

export default function Prospects() {
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: prospects, isLoading } = useQuery({
    queryKey: ['prospects', q],
    queryFn: () => api(`/prospects${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });

  const { sorted: sortedProspects, sortKey, sortDir, toggleSort } = useSort(prospects);

  const createMutation = useMutation({
    mutationFn: (body) => api('/prospects', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      setShowForm(false);
    },
  });

  function handleCreate(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    createMutation.mutate({
      name: form.get('name'),
      company: form.get('company'),
      title: form.get('title'),
      email: form.get('email'),
      linkedin_url: form.get('linkedin_url'),
      source: form.get('source'),
    });
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-7 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">Contacts</h1>
          <p className="mt-1 text-sm text-ink-500">
            {prospects ? `${prospects.length} people identified across your companies` : 'Loading…'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add contact'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 grid grid-cols-2 gap-3 p-5">
          <input name="name" placeholder="Name *" className="input" required />
          <input name="company" placeholder="Company" className="input" />
          <input name="title" placeholder="Title" className="input" />
          <input name="email" placeholder="Email" className="input" />
          <input name="linkedin_url" placeholder="LinkedIn URL" className="input" />
          <input name="source" placeholder="Source" className="input" />
          <div className="col-span-2">
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <input
        placeholder="Search by name or company…"
        className="input mb-6 max-w-xs"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {isLoading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : prospects?.length === 0 ? (
        <p className="text-sm text-ink-400">No prospects yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-ink-400">
              <tr>
                {[
                  ['name', 'Name'],
                  ['company', 'Company'],
                  ['title', 'Title'],
                  ['company_tier', 'Company tier'],
                  ['hiring_signal', 'Hiring signal'],
                  ['linkedin_url', 'LinkedIn'],
                  ['status', 'Status'],
                  ['source', 'Source'],
                ].map(([key, label]) => (
                  <SortableHeader
                    key={key}
                    sortKey={key}
                    label={label}
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {sortedProspects?.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-brand-50/40">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink-900">{p.name}</td>
                  <td className="px-4 py-2.5 text-ink-600">{p.company}</td>
                  <td className="px-4 py-2.5 text-ink-600">{p.title}</td>
                  <td className="px-4 py-2.5">
                    {p.company_tier ? <Badge variant={p.company_tier === 2 ? 'signal' : 'neutral'}>Tier {p.company_tier}</Badge> : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.hiring_signal ? (
                      <span title={p.hiring_signal_titles || ''}>
                        <Badge variant="signal">{p.hiring_signal_titles || 'Hiring'}</Badge>
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.linkedin_url ? (
                      <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                        View ↗
                      </a>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={p.status === 'qualified' ? 'good' : 'neutral'}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-500">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
