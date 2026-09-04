export default function SortableHeader({ label, sortKey, currentKey, currentDir, onSort }) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-4 py-2.5 transition-colors hover:text-ink-700 ${
        active ? 'text-brand-600' : ''
      }`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active && <span className="ml-1 text-brand-500">{currentDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}
