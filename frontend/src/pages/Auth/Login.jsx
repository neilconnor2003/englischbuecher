// frontend/src/pages/Auth/Login.jsx
import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import config from '../../config';
import { Mail, Lock, LogIn, AlertCircle, CheckCircle } from 'lucide-react';

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { checkAuth } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData(e.target);
    const email = formData.get('email')?.trim();
    const password = formData.get('password');

    if (!email || !password) {
      setError(t('login_all_fields_required') || 'Email and password are required');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${config.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();

      if (res.ok && json.success) {
        await checkAuth();                    // update user instantly
        window.location.href = '/';
      } else {
        // === CUSTOM ERROR MESSAGES ===
        if (json.error?.includes('unverified')) {
          setError(
            <>
              {t('login_email_not_verified') || 'Please verify your email first.'}
              <Link
                to="/resend-verification"
                className="ml-2 text-blue-600 underline hover:text-blue-800"
              >
                {t('resend_link') || 'Resend verification email'}
              </Link>
            </>
          );
        } else if (json.error?.includes('Invalid')) {
          setError(t('login_invalid_credentials') || 'Invalid email or password');
        } else {
          setError(json.error || t('login_failed') || 'Login failed');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(t('network_error') || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `${config.API_URL}/auth/google`,
      'google-login',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data === 'google-login-success') {
        window.removeEventListener('message', handleMessage);
        clearInterval(checkClosed);
        // FULL RELOAD → cookies are read → user appears
        window.location.href = '/';
      }
    };

    window.addEventListener('message', handleMessage);

    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        fetch(`${config.API_URL}/api/current-user`, { credentials: 'include' })
          .then(r => r.json())
          .then(data => { if (data.id) window.location.href = '/'; })
          .catch(() => { });
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:scale-[1.01]">
          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800">{t('login')}</h2>
            <p className="text-gray-600 mt-2">{t('login_welcome')}</p>
          </div>

          {/* ERROR / SUCCESS MESSAGES */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login_email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  placeholder={t('login_email_placeholder')}
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login_password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  placeholder={t('login_password_placeholder')}
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t('login_submitting') || 'Logging in...'}
                </>
              ) : (
                t('login_submit')
              )}
            </button>
          </form>

          {/* DIVIDER */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">{t('or')}</span>
              </div>
            </div>

            {/* GOOGLE LOGIN */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="mt-4 w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transform transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#fff" d="M12 6.25c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t('login_google')}
            </button>
          </div>

          {/* REGISTER LINK */}
          <p className="text-center mt-6 text-sm text-gray-600">
            {t('login_no_account')}{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
              {t('register')}
            </Link>
          </p>

          {/* FORGOT PASSWORD */}
          <p className="text-center mt-2 text-sm text-gray-500">
            <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 underline">
              {t('forgot_password') || 'Forgot password?'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;