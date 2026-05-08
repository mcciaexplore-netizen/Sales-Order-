import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Loading from './Loading.jsx';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loading label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="card text-center max-w-md mx-auto mt-12">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Access denied</h2>
        <p className="text-slate-600">
          Your role ({user.role}) doesn't have permission to view this page.
        </p>
      </div>
    );
  }

  return children;
}
