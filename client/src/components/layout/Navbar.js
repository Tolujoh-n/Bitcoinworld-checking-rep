import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  FaSearch, 
  FaSun, 
  FaMoon, 
  FaUser, 
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaBitcoin
} from 'react-icons/fa';
import AuthModal from '../auth/AuthModal';
import SearchModal from '../search/SearchModal';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const categories = [
    { name: 'Politics', path: '/politics' },
    { name: 'Trending', path: '/trending' },
    { name: 'Middle East', path: '/middle-east' },
    { name: 'Sports', path: '/sports' },
    { name: 'Crypto', path: '/crypto' },
    { name: 'Tech', path: '/tech' },
    { name: 'Culture', path: '/culture' },
    { name: 'World', path: '/world' },
    { name: 'Economy', path: '/economy' },
    { name: 'Elections', path: '/elections' },
    { name: 'Mentions', path: '/mentions' }
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActiveCategory = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      {/* Main Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-soft border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        {/* Top Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <Link to="/" className="flex items-center space-x-3">
              <FaBitcoin className="w-8 h-8 text-bitcoin-500" />
              <span className="text-xl font-bold gradient-text">BitcoinWorld</span>
            </Link>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search polls..."
                  className="input pl-10 pr-4 w-full"
                  onClick={() => setShowSearchModal(true)}
                  readOnly
                />
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              {/* Search Button (Mobile) */}
              <button
                onClick={() => setShowSearchModal(true)}
                className="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaSearch className="w-5 h-5" />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {isDark ? <FaSun className="w-5 h-5" /> : <FaMoon className="w-5 h-5" />}
              </button>

              {/* Auth Buttons */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <FaUser className="w-4 h-4" />
                    <span className="hidden sm:block">{user?.username}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                  >
                    <FaSignOutAlt className="w-4 h-4" />
                    <span className="hidden sm:block">Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="btn-primary"
                  >
                    Login / Signup
                  </button>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showMobileMenu ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Category Navigation */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-8 overflow-x-auto scrollbar-hide py-3">
              {categories.map((category) => (
                <Link
                  key={category.name}
                  to={category.path}
                  className={`whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActiveCategory(category.path)
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {categories.map((category) => (
                <Link
                  key={category.name}
                  to={category.path}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActiveCategory(category.path)
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Modals */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      <SearchModal 
        isOpen={showSearchModal} 
        onClose={() => setShowSearchModal(false)} 
      />
    </>
  );
};

export default Navbar;
