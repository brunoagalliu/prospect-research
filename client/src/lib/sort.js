import { useMemo, useState } from 'react';

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls sort last regardless of direction
  if (b == null) return -1;
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

// Client-side sort for an already-fetched array. Clicking the same key again flips
// direction; clicking a new key starts ascending.
export function useSort(rows, initialKey = null, initialDir = 'asc') {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !rows) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const result = compareValues(a[sortKey], b[sortKey]);
      return sortDir === 'asc' ? result : -result;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}
