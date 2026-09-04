import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useSort } from '../lib/sort';
import SortableHeader from '../components/SortableHeader';

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
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contacts</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add contact'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-3 rounded-lg bg-white p-4 shadow-sm">
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
        className="input mb-4"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : prospects?.length === 0 ? (
        <p className="text-sm text-gray-500">No prospects yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
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
            <tbody className="divide-y divide-gray-100">
              {sortedProspects?.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2">{p.company}</td>
                  <td className="px-4 py-2">{p.title}</td>
                  <td className="px-4 py-2">{p.company_tier ? `Tier ${p.company_tier}` : '—'}</td>
                  <td className="px-4 py-2">
                    {p.hiring_signal ? (
                      <span title={p.hiring_signal_titles || ''} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Yes{p.hiring_signal_titles ? ` — ${p.hiring_signal_titles}` : ''}
                      </span>
                    ) : (
                      'No'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {p.linkedin_url ? (
                      <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                        View ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">{p.status}</td>
                  <td className="px-4 py-2">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
