import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotebooks } from '../api/client';

/**
 * Jump target for the "Workspace" navbar link. Workspaces are notebook-scoped,
 * so this resolves to the most recently updated notebook's workspace; with no
 * notebooks yet it lands on the notebooks home where the first one can be made.
 */
export default function Workspace() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    listNotebooks()
      .then((notebooks) => {
        if (cancelled) return;
        if (notebooks.length === 0) {
          navigate('/notebooks', { replace: true });
          return;
        }
        const mostRecent = [...notebooks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        navigate(`/notebooks/${mostRecent.id}`, { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate('/notebooks', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}