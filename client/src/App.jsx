import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './api';
import Login from './pages/Login';
import Prospects from './pages/Prospects';

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Prospects />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
