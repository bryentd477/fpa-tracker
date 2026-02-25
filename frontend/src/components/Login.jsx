import React, { useState } from 'react';
import { signInWithEmail, signUpWithEmail, sendPasswordReset } from '../utils/firebase';

function Login({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up and request access
        console.log('Starting signup for:', email);
        const { status, role } = await signUpWithEmail(email, password, username);
        const isAdmin = status === 'approved' && (role === 'admin' || role === 'super_admin');
        setSuccessMessage(
          isAdmin
            ? '✓ Account created! You are now approved as the administrator. Please sign in with your credentials.'
            : '✓ Account created! Your account needs to be approved before you can sign in.'
        );
        setIdentifier('');
        setEmail('');
        setUsername('');
        setPassword('');
        setIsSignUp(false);
      } else {
        console.log('Signing in:', identifier);
        await signInWithEmail(identifier, password);
        console.log('Sign in successful');
        onLoginSuccess();
      }
    } catch (err) {
      console.error('Auth error:', err);
      const message = err.message || 'Authentication failed';
      if (message.includes('auth/invalid-credential')) {
        setError('Email/username or password is incorrect. Use "Forgot password?" to reset.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const resetEmail = isSignUp ? email.trim() : identifier.trim();
    if (!resetEmail) {
      setError('Enter your email first, then click reset.');
      return;
    }
    if (!resetEmail.includes('@')) {
      setError('Password reset requires an email address. Enter your email, then click reset.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      await sendPasswordReset(resetEmail);
      setSuccessMessage('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img
            src="/Gemini_Generated_Image_mxco7smxco7smxco.png"
            alt="FPA Tracking"
            className="login-logo-image"
          />
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp ? (
            <>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Email or Username</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter email or username"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={loading}
              />
              <span>Show password</span>
            </label>
            {!isSignUp && (
              <button
                type="button"
                className="forgot-password"
                onClick={handlePasswordReset}
                disabled={loading}
              >
                Forgot password?
              </button>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <button 
            type="submit" 
            className="btn-login"
            disabled={loading}
          >
            {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>

          {!isSignUp && (
            <div className="forgot-row">
              <button
                type="button"
                className="forgot-password"
                onClick={handlePasswordReset}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>

        <div className="login-footer">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccessMessage('');
                setPassword('');
              }}
              className="toggle-auth"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
          {isSignUp && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              📝 First user will be auto-approved as admin. Other users require admin approval.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
