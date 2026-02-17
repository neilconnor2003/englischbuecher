import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import config from '@config';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('i18nextLng') || 'de';
    i18n.changeLanguage(savedLang);
  }, [i18n]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError(t('password_mismatch'));
    if (password.length < 8) return setError(t('password_too_short'));

    setLoading(true);
    try {
      const res = await fetch(`${config.API_URL}/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(t('reset_success'));
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.error || 'Link expired');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800">{t('password_reset')}</h2>
          </div>

          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800">{message}</p>
              <p className="text-sm text-gray-600 mt-2">{t('redirecting_login')}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!message && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('new_password')}
                required
                minLength="8"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('confirm_password')}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={loading || password !== confirm || password.length < 8}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : t('change_password') || 'Change Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}