import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
      <p className="text-sm text-gray-900">{value ?? '—'}</p>
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
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }
  if (!company) return null;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to="/companies" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        &larr; Back to companies
      </Link>

      <div className="mb-6 flex items-start justify-between rounded-lg bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-gray-500">
            {[company.industry, company.location].filter(Boolean).join(' · ')}
          </p>
          {company.domain && (
            <a
              href={`https://${company.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-600 hover:underline"
            >
              {company.domain}
            </a>
          )}
        </div>
        <select
          className="input max-w-[160px]"
          value={company.status}
          onChange={(e) => statusMutation.mutate(e.target.value)}
        >
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="contacted">Contacted</option>
          <option value="disqualified">Disqualified</option>
        </select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-white p-6 shadow-sm sm:grid-cols-3">
        <Field label="Employees" value={company.employee_count} />
        <Field
          label="Headcount growth"
          value={company.headcount_growth_pct != null ? `${company.headcount_growth_pct}%` : null}
        />
        <Field label="Funding stage" value={company.funding_stage} />
        <Field
          label="Total raised"
          value={company.total_raised != null ? `$${Number(company.total_raised).toLocaleString()}` : null}
        />
        <Field label="Marketing headcount" value={company.marketing_headcount} />
        <Field
          label="Has ops hire"
          value={company.has_ops_hire ? `Yes${company.ops_hire_titles ? ` (${company.ops_hire_titles})` : ''}` : 'No'}
        />
        <Field
          label="Hiring signal"
          value={company.hiring_signal ? `Yes${company.hiring_signal_titles ? ` (${company.hiring_signal_titles})` : ''}` : 'No'}
        />
        <Field label="Tier" value={company.tier ? `Tier ${company.tier}` : 'Unscored'} />
        <Field label="Score" value={company.score} />
        <Field label="Source" value={company.source} />
      </div>

      {company.tech_stack?.length > 0 && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Tech stack</h2>
          <div className="flex flex-wrap gap-2">
            {company.tech_stack.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {company.qualitative_notes && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Qualitative notes</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-600">{company.qualitative_notes}</p>
        </div>
      )}

      {company.notes && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-600">{company.notes}</p>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Contacts ({company.contacts?.length || 0})</h2>
        {company.contacts?.length ? (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {company.contacts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 font-medium">{p.name}</td>
                  <td className="py-2 pr-4">{p.title || '—'}</td>
                  <td className="py-2 pr-4">{p.email || '—'}</td>
                  <td className="py-2 pr-4">{p.phone || '—'}</td>
                  <td className="py-2 pr-4">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">No contacts yet.</p>
        )}
      </div>
    </div>
  );
}
