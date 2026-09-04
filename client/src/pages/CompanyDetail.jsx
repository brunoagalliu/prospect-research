import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import Badge from '../components/Badge';

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-0.5 text-sm text-ink-900 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api(`/companies/${id}`),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api(`/companies/${id}`, { method: 'PUT', body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-sm text-ink-400">Loading…</p>
      </div>
    );
  }
  if (!company) return null;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link to="/companies" className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-brand-600">
        &larr; Back to companies
      </Link>

      <div className="card mb-6 flex items-start justify-between gap-6 p-6">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-ink-900">{company.name}</h1>
            {company.tier && <Badge variant={company.tier === 2 ? 'signal' : 'neutral'}>Tier {company.tier}</Badge>}
            {company.hiring_signal && <Badge variant="signal">Hiring</Badge>}
          </div>
          <p className="text-sm text-ink-500">
            {[company.industry, company.location].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-1.5 flex gap-4">
            {company.domain && (
              <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
                {company.domain}
              </a>
            )}
            {company.linkedin_url && (
              <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
                LinkedIn ↗
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-3">
          <div className="text-right">
            <p className="text-[0.7rem] font-medium uppercase tracking-wide text-ink-400">Score</p>
            <p className="font-mono text-3xl font-bold leading-none text-ink-900">{company.score ?? '—'}</p>
          </div>
          <select className="input max-w-[160px]" value={company.status} onChange={(e) => statusMutation.mutate(e.target.value)}>
            <option value="new">New</option>
            <option value="qualified">Qualified</option>
            <option value="contacted">Contacted</option>
            <option value="disqualified">Disqualified</option>
          </select>
        </div>
      </div>

      <div className="card mb-6 grid grid-cols-2 gap-x-6 gap-y-5 p-6 sm:grid-cols-3">
        <Field label="Employees" value={company.employee_count} mono />
        <Field label="Headcount growth" value={company.headcount_growth_pct != null ? `${company.headcount_growth_pct}%` : null} mono />
        <Field label="Funding stage" value={company.funding_stage} />
        <Field label="Total raised" value={company.total_raised != null ? `$${Number(company.total_raised).toLocaleString()}` : null} mono />
        <Field label="Marketing headcount" value={company.marketing_headcount} mono />
        <Field label="Has ops hire" value={company.has_ops_hire ? `Yes${company.ops_hire_titles ? ` (${company.ops_hire_titles})` : ''}` : 'No'} />
        <Field label="Hiring signal" value={company.hiring_signal ? `Yes${company.hiring_signal_titles ? ` (${company.hiring_signal_titles})` : ''}` : 'No'} />
        <Field label="Source" value={company.source} />
      </div>

      {company.tech_stack?.length > 0 && (
        <div className="card mb-6 p-6">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Tech stack</h2>
          <div className="flex flex-wrap gap-1.5">
            {company.tech_stack.map((t) => (
              <span key={t} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-600">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {company.qualitative_notes && (
        <div className="card mb-6 p-6">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Qualitative notes</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-600">{company.qualitative_notes}</p>
        </div>
      )}

      {company.notes && (
        <div className="card mb-6 p-6">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-600">{company.notes}</p>
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-700">Contacts ({company.contacts?.length || 0})</h2>
        {company.contacts?.length ? (
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-ink-400">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">LinkedIn</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {company.contacts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-4 font-medium text-ink-900">{p.name}</td>
                  <td className="py-2.5 pr-4 text-ink-600">{p.title || '—'}</td>
                  <td className="py-2.5 pr-4 text-ink-600">{p.email || '—'}</td>
                  <td className="py-2.5 pr-4 font-mono text-ink-600">{p.phone || '—'}</td>
                  <td className="py-2.5 pr-4">
                    {p.linkedin_url ? (
                      <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                        View ↗
                      </a>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={p.status === 'qualified' ? 'good' : 'neutral'}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-ink-400">No contacts yet.</p>
        )}
      </div>
    </div>
  );
}
