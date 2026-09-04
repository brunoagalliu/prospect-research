import { NavLink, useNavigate } from 'react-router-dom';
import { setToken } from '../api';

const ITEMS = [
  { to: '/companies', label: 'Companies' },
  { to: '/prospects', label: 'Contacts' },
  { to: '/pipeline', label: 'Pipeline' },
];

export default function Sidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    setToken(null);
    navigate('/login');
  }

  const linkClass = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <aside className="sticky top-0 flex h-screen w-56 flex-none flex-col border-r bg-white">
      <div className="px-4 py-5">
        <span className="text-sm font-semibold">Prospect Research</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t px-3 py-4">
        <button className="text-sm text-gray-500 hover:text-gray-700" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}
