import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBookmark, FaBookmark as FaBookmarkSolid, FaChartLine, FaClock, FaUser } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import axios from '../../setupAxios';
import toast from 'react-hot-toast';

const PollCard = ({ poll, compact = false }) => {
  const { isAuthenticated } = useAuth();
  const [isSaved, setIsSaved] = useState(poll.isSaved || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast.error('Please login to save polls');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`/api/polls/${poll._id}/save`);
      setIsSaved(response.data.saved);
      toast.success(response.data.message);
    } catch (error) {
      toast.error('Failed to save poll');
    } finally {
      setSaving(false);
    }
  };

  const formatTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getLeadingOption = () => {
    if (!poll.options || poll.options.length === 0) return null;
    return poll.options.reduce((leading, option) => 
      option.percentage > leading.percentage ? option : leading
    );
  };

  const leadingOption = getLeadingOption();

  if (compact) {
    return (
      <Link to={`/poll/${poll._id}`} className="card-hover">
        <div className="p-4">
          {poll.image && (
            <img
              src={poll.image}
              alt={poll.title}
              className="w-full h-32 object-cover rounded-lg mb-3"
            />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2 line-clamp-2">
            {poll.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{poll.category}</span>
            <span>{formatTimeRemaining(poll.endDate)}</span>
          </div>
          {leadingOption && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-300">{leadingOption.text}</span>
                <span className="font-medium">{leadingOption.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div
                  className="bg-primary-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${leadingOption.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="card-hover">
      <Link to={`/poll/${poll._id}`} className="block p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs font-medium rounded">
              {poll.category}
            </span>
            {poll.trending && (
              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                Trending
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            {saving ? (
              <div className="spinner w-4 h-4" />
            ) : isSaved ? (
              <FaBookmarkSolid className="w-4 h-4 text-primary-600" />
            ) : (
              <FaBookmark className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Image */}
        {poll.image && (
          <img
            src={poll.image}
            alt={poll.title}
            className="w-full h-48 object-cover rounded-lg mb-4"
          />
        )}

        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg mb-3 line-clamp-2">
          {poll.title}
        </h3>

        {/* Options */}
        {poll.options && poll.options.length > 0 && (
          <div className="space-y-2 mb-4">
            {poll.options.slice(0, 2).map((option, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                  {option.text}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 ml-2">
                  {option.percentage}%
                </span>
              </div>
            ))}
            {poll.options.length > 2 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                +{poll.options.length - 2} more options
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <FaChartLine className="w-3 h-3" />
              <span>${poll.totalVolume?.toLocaleString() || '0'}</span>
            </span>
            <span className="flex items-center space-x-1">
              <FaUser className="w-3 h-3" />
              <span>{poll.uniqueTraders || 0}</span>
            </span>
          </div>
          <span className="flex items-center space-x-1">
            <FaClock className="w-3 h-3" />
            <span>{formatTimeRemaining(poll.endDate)}</span>
          </span>
        </div>

        {/* Progress Bar */}
        {leadingOption && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${leadingOption.percentage}%` }}
              />
            </div>
          </div>
        )}
      </Link>
    </div>
  );
};

export default PollCard;
