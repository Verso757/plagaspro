import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bug, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Bug size={48} color="var(--primary)" />
        </div>
        <h1>Plagas<span>Pro</span></h1>
        <p>Sistema de Control de Plagas</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@plagas.com" required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••" required />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            <LogIn size={18} /> {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--gray-500)', textAlign: 'center' }}>
          <div>Admin: admin@plagas.com / admin123</div>
          <div>Técnico: tecnico1@plagas.com / tecnico123</div>
        </div>
      </div>
    </div>
  );
}