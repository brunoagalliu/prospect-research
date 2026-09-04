import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import CompanyTable from '../components/CompanyTable';

const TIER_SECTIONS = [
  { tier: 2, title: 'Tier 2 — Active Searcher', description: 'Live hiring signal for GTM Engineer / RevOps / Marketing Ops — highest intent, reach out first.' },
  { tier: 1, title: 'Tier 1 — Capacity-Constrained Believer', description: 'Baseline ICP: 20–70 employees, thin marketing team, no ops hire yet.' },
  { tier: 3, title: 'Tier 3 — Post-Raise Scaler', description: 'Series B+, existing ops hire, fragmented stack. Not yet sourced.' },
];

export default function Companies() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const qs = params.toString();

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies', q, status],
    queryFn: () => api(`/companies${qs ? `?${qs}` : ''}`),
  });

  const unscored = companies?.filter((c) => !TIER_SECTIONS.some((s) => s.tier === c.tier)) || [];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Companies{' '}
          {companies ? <span className="text-sm font-normal text-gray-500">({companies.length})</span> : null}
        </h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          placeholder="Search by name or domain…"
          className="input max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
        <div className="space-y-8">
          {TIER_SECTIONS.map(({ tier, title, description }) => {
            const tierCompanies = companies.filter((c) => c.tier === tier);
            return (
              <section key={tier}>
                <div className="mb-2">
                  <h2 className="text-base font-semibold">
                    {title} <span className="font-normal text-gray-500">({tierCompanies.length})</span>
                  </h2>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
                <CompanyTable companies={tierCompanies} />
              </section>
            );
          })}

          {unscored.length > 0 && (
            <section>
              <div className="mb-2">
                <h2 className="text-base font-semibold">
                  Unscored <span className="font-normal text-gray-500">({unscored.length})</span>
                </h2>
                <p className="text-xs text-gray-500">No tier assigned yet.</p>
              </div>
              <CompanyTable companies={unscored} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
