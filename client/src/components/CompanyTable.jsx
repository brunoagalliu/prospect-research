import { useNavigate } from 'react-router-dom';
import { useSort } from '../lib/sort';
import SortableHeader from './SortableHeader';

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
    return <p className="text-sm text-gray-500">No companies here yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
          <tr>
            {COLUMNS.map(([key, label]) => (
              <SortableHeader key={key} sortKey={key} label={label} currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((c) => (
            <tr key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/companies/${c.id}`)}>
              <td className="px-4 py-2 font-medium">{c.name}</td>
              <td className="px-4 py-2">{c.industry || '—'}</td>
              <td className="px-4 py-2">{c.employee_count ?? '—'}</td>
              <td className="px-4 py-2">{c.location || '—'}</td>
              <td className="px-4 py-2">{c.marketing_headcount ?? '—'}</td>
              <td className="px-4 py-2">{c.has_ops_hire ? 'Yes' : 'No'}</td>
              <td className="px-4 py-2">{c.hiring_signal ? 'Yes' : 'No'}</td>
              <td className="px-4 py-2">
                {c.linkedin_url ? (
                  <a
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View ↗
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-2">{c.score ?? '—'}</td>
              <td className="px-4 py-2">{c.status}</td>
              <td className="px-4 py-2">{c.source || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
