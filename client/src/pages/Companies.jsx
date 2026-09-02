import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSort } from '../lib/sort';
import SortableHeader from '../components/SortableHeader';

export default function Companies() {
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tier) params.set('tier', tier);
  if (status) params.set('status', status);
  const qs = params.toString();

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies', q, tier, status],
    queryFn: () => api(`/companies${qs ? `?${qs}` : ''}`),
  });

  const { sorted: sortedCompanies, sortKey, sortDir, toggleSort } = useSort(companies);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Companies{' '}
          {companies ? <span className="text-sm font-normal text-gray-500">({companies.length})</span> : null}
        </h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Search by name or domain…"
          className="input max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input max-w-[140px]" value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">All tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="contacted">Contacted</option>
          <option value="disqualified">Disqualified</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : companies?.length === 0 ? (
        <p className="text-sm text-gray-500">No companies yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                {[
                  ['name', 'Name'],
                  ['industry', 'Industry'],
                  ['employee_count', 'Employees'],
                  ['location', 'Location'],
                  ['marketing_headcount', 'Marketing HC'],
                  ['has_ops_hire', 'Ops hire?'],
                  ['hiring_signal', 'Hiring signal'],
                  ['tier', 'Tier'],
                  ['score', 'Score'],
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
              {sortedCompanies?.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/companies/${c.id}`)}
                >
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.industry || '—'}</td>
                  <td className="px-4 py-2">{c.employee_count ?? '—'}</td>
                  <td className="px-4 py-2">{c.location || '—'}</td>
                  <td className="px-4 py-2">{c.marketing_headcount ?? '—'}</td>
                  <td className="px-4 py-2">{c.has_ops_hire ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{c.hiring_signal ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{c.tier ? `Tier ${c.tier}` : '—'}</td>
                  <td className="px-4 py-2">{c.score ?? '—'}</td>
                  <td className="px-4 py-2">{c.status}</td>
                  <td className="px-4 py-2">{c.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
