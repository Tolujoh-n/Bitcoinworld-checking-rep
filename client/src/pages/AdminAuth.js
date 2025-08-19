import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminAuth = () => {
  const navigate = useNavigate();
  const { refreshToken } = useAuth();
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = mode === 'login' ? '/api/auth/admin-login' : '/api/auth/admin-register';
      const res = await axios.post(url, { walletAddress });
      const { token } = res.data;
      // Store token and refresh auth context
      localStorage.setItem('bitcoinworld-token', token);
      await refreshToken();
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-soft p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Admin {mode === 'login' ? 'Login' : 'Registration'}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Authenticate with your wallet address.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Wallet Address</label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x... or any wallet id"
              className="input w-full"
              required
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <button type="submit" disabled={loading || walletAddress.length < 4} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Please wait...' : mode === 'login' ? 'Login as Admin' : 'Register as Admin'}
          </button>
        </form>
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {mode === 'login' ? (
            <>
              Don’t have admin access?
              <button onClick={() => setMode('register')} className="ml-1 text-primary-600 dark:text-primary-400">Register</button>
            </>
          ) : (
            <>
              Already an admin?
              <button onClick={() => setMode('login')} className="ml-1 text-primary-600 dark:text-primary-400">Login</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;


