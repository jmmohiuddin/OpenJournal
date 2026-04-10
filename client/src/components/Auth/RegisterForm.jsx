import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure, clearError } from '../../store/authSlice';
import api from '../../services/api';
import { signInWithGoogle } from '../../services/firebase';

export default function RegisterForm() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { loading, error } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    dispatch(loginStart());

    try {
      const { data } = await api.post('/auth/register', { 
        email, 
        password, 
        displayName 
      });
      dispatch(loginSuccess(data.data));
      navigate('/');
    } catch (err) {
      dispatch(loginFailure(err.response?.data?.message || 'Registration failed'));
    }
  };

  const handleGoogleSignIn = async () => {
    dispatch(loginStart());
    try {
      const firebaseUser = await signInWithGoogle();
      const { data } = await api.post('/auth/google', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL
      });
      dispatch(loginSuccess(data.data));
      navigate('/');
    } catch (err) {
      dispatch(loginFailure(err.response?.data?.message || err.message || 'Google sign-in failed'));
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-alice-blue px-4 py-8">
      <div className="max-w-md w-full card-glass p-6 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#ABC4FF,#D6EADF)', boxShadow: '0 4px 16px rgba(171,196,255,0.4)' }}>
            ✦
          </div>
          <h1 className="text-fluid-h2 font-semibold text-gray-800 mb-2 font-journal">Create Account</h1>
          <p className="text-gray-500 font-system text-sm sm:text-base">Start your reflection journey</p>
        </div>

        {displayError && (
          <div className="mb-6 p-4 bg-peach-crayola/20 border border-peach-crayola/50 rounded-xl">
            <p className="text-sm text-gray-700 font-system">{displayError}</p>
            <button 
              onClick={() => {
                setLocalError('');
                dispatch(clearError());
              }}
              className="text-xs text-gray-500 mt-2 hover:text-gray-700 touch-target font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 font-system">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-lavender-web rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-eyes focus:border-transparent transition font-system bg-white/60 text-base"
              placeholder="How should we call you?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 font-system">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-lavender-web rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-eyes focus:border-transparent transition font-system bg-white/60 text-base"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 font-system">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-lavender-web rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-eyes focus:border-transparent transition font-system bg-white/60 text-base"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 font-system">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-lavender-web rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-eyes focus:border-transparent transition font-system bg-white/60 text-base"
              placeholder="Repeat your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-blue-eyes text-white font-medium font-system rounded-xl hover:bg-opacity-90 disabled:opacity-50 transition shadow-md touch-target"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 sm:mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-lavender-web"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-alice-blue text-gray-500 font-medium tracking-wide uppercase">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-6 w-full py-3.5 px-4 bg-white/80 border border-lavender-web rounded-xl flex items-center justify-center gap-3 hover:bg-white disabled:opacity-50 transition touch-target shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700 font-system font-medium">Google</span>
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500 font-system">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-eyes font-semibold hover:underline px-1 py-2 touch-target">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
