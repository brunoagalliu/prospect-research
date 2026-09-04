import { useNavigate } from 'react-router-dom';
import { useSort } from '../lib/sort';
import SortableHeader from './SortableHeader';
import Badge from './Badge';

const COLUMNS = [
  ['name', 'Name'],
  ['industry', 'Industry'],
  ['employee_count', 'Employees'],
  ['location', 'Location'],
  ['marketing_headcount', 'Marketing HC'],
  ['has_ops_hire', 'Ops hire?'],
  ['hiring_signal', 'Hiring signal'],
  ['linkedin_url', 'LinkedIn'],
  ['score', 'Score'],
  ['status', 'Status'],
  ['source', 'Source'],
];

export default function CompanyTable({ companies }) {
  const navigate = useNavigate();
  const { sorted, sortKey, sortDir, toggleSort } = useSort(companies, 'score', 'desc');

  if (companies.length === 0) {
    return <p className="px-1 text-sm text-ink-400">No companies here yet.</p>;
  }

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-ink-100 text-sm">
        <thead className="text-left text-xs font-medium uppercase tracking-wide text-ink-400">
          <tr>
            {COLUMNS.map(([key, label]) => (
              <SortableHeader key={key} sortKey={key} label={label} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50">
          {sorted.map((c) => (
            <tr key={c.id} className="cursor-pointer transition-colors hover:bg-brand-50/40" onClick={() => navigate(`/companies/${c.id}`)}>
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink-900">{c.name}</td>
              <td className="px-4 py-2.5 text-ink-600">{c.industry || '—'}</td>
              <td className="px-4 py-2.5 font-mono text-ink-600">{c.employee_count ?? '—'}</td>
              <td className="px-4 py-2.5 text-ink-600">{c.location || '—'}</td>
              <td className="px-4 py-2.5 font-mono text-ink-600">{c.marketing_headcount ?? '—'}</td>
              <td className="px-4 py-2.5">
                {c.has_ops_hire ? <Badge variant="neutral">Yes</Badge> : <span className="text-ink-300">—</span>}
              </td>
              <td className="px-4 py-2.5">
                {c.hiring_signal ? <Badge variant="signal">Hiring</Badge> : <span className="text-ink-300">—</span>}
              </td>
              <td className="px-4 py-2.5">
                {c.linkedin_url ? (
                  <a
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View ↗
                  </a>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 font-mono font-semibold text-ink-900">{c.score ?? '—'}</td>
              <td className="px-4 py-2.5">
                <Badge variant={c.status === 'qualified' ? 'good' : 'neutral'}>{c.status}</Badge>
              </td>
              <td className="px-4 py-2.5 text-ink-500">{c.source || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
