import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import CompanyTable from '../components/CompanyTable';

const TIER_SECTIONS = [
  { tier: 2, title: 'Tier 2 — Active Searcher', description: 'Live hiring signal for GTM Engineer / RevOps / Marketing Ops — highest intent, reach out first.', accent: 'border-brand-400' },
  { tier: 1, title: 'Tier 1 — Capacity-Constrained Believer', description: 'Baseline ICP: 20–70 employees, thin marketing team, no ops hire yet.', accent: 'border-ink-300' },
  { tier: 3, title: 'Tier 3 — Post-Raise Scaler', description: 'Series B+, existing ops hire, fragmented stack. Not yet sourced.', accent: 'border-ink-200' },
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
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-7 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">Companies</h1>
          <p className="mt-1 text-sm text-ink-500">
            {companies ? `${companies.length} tracked across your pipeline` : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
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
        <p className="text-sm text-ink-400">Loading…</p>
      ) : companies?.length === 0 ? (
        <p className="text-sm text-ink-400">No companies yet.</p>
      ) : (
        <div className="space-y-10">
          {TIER_SECTIONS.map(({ tier, title, description, accent }) => {
            const tierCompanies = companies.filter((c) => c.tier === tier);
            return (
              <section key={tier} className={`border-l-2 pl-5 ${accent}`}>
                <div className="mb-3">
                  <h2 className="font-display text-lg font-bold text-ink-900">
                    {title} <span className="font-sans text-sm font-normal text-ink-400">({tierCompanies.length})</span>
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-500">{description}</p>
                </div>
                <CompanyTable companies={tierCompanies} />
              </section>
            );
          })}

          {unscored.length > 0 && (
            <section className="border-l-2 border-ink-200 pl-5">
              <div className="mb-3">
                <h2 className="font-display text-lg font-bold text-ink-900">
                  Unscored <span className="font-sans text-sm font-normal text-ink-400">({unscored.length})</span>
                </h2>
                <p className="mt-0.5 text-sm text-ink-500">No tier assigned yet.</p>
              </div>
              <CompanyTable companies={unscored} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
