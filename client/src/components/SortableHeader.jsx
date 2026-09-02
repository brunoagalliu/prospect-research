export default function SortableHeader({ label, sortKey, currentKey, currentDir, onSort }) {
  const active = currentKey === sortKey;
  return (
    <th
      className="cursor-pointer select-none px-4 py-2 hover:text-gray-700"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active && <span className="ml-1">{currentDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}
