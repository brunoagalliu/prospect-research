import { NavLink, useNavigate } from 'react-router-dom';
import { setToken } from '../api';

const ICONS = {
  companies: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
  ),
  contacts: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  ),
  pipeline: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  ),
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px] flex-none">
      {ICONS[name]}
    </svg>
  );
}

const ITEMS = [
  { to: '/companies', label: 'Companies', icon: 'companies' },
  { to: '/prospects', label: 'Contacts', icon: 'contacts' },
  { to: '/pipeline', label: 'Pipeline', icon: 'pipeline' },
];

export default function Sidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    setToken(null);
    navigate('/login');
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'
    }`;

  return (
    <aside className="sticky top-0 flex h-screen w-56 flex-none flex-col border-r border-ink-100 bg-white">
      <div className="px-5 py-6">
        <span className="font-display text-[1.05rem] font-bold tracking-tight text-ink-900">
          Prospect<span className="text-brand-500">.</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mx-3 mb-4 border-t border-ink-100 pt-4">
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          onClick={handleLogout}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px] flex-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Log out
        </button>
      </div>
    </aside>
  );
}
