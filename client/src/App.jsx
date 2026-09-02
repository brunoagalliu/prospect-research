import { Navigate, Route, Routes, Outlet } from 'react-router-dom';
import { getToken } from './api';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Prospects from './pages/Prospects';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';

function RequireAuth() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Navigate to="/companies" replace />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyDetail />} />
        <Route path="/prospects" element={<Prospects />} />
      </Route>
    </Routes>
  );
}
