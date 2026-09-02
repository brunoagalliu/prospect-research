import { NavLink, useNavigate } from 'react-router-dom';
import { setToken } from '../api';

export default function NavBar() {
  const navigate = useNavigate();

  function handleLogout() {
    setToken(null);
    navigate('/login');
  }

  const linkClass = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-1">
          <span className="mr-4 text-sm font-semibold">Prospect Research</span>
          <NavLink to="/companies" className={linkClass}>Companies</NavLink>
          <NavLink to="/prospects" className={linkClass}>Contacts</NavLink>
        </div>
        <button className="text-sm text-gray-500 hover:text-gray-700" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
