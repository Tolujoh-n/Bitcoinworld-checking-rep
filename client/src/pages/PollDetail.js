import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from '../setupAxios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FaChartLine, FaClock } from 'react-icons/fa';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import CommentsSection from '../components/comments/CommentsSection';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const PollDetail = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [side, setSide] = useState('buy');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('0.5');

  const { data, isLoading, error } = useQuery(
    ['poll-detail', id],
    async () => {
      const response = await axios.get(`/api/polls/${id}`);
      return response.data;
    },
    { staleTime: 60 * 1000 }
  );

  const tradeMutation = useMutation(
    async () => {
      const payload = {
        pollId: id,
        type: side,
        optionIndex: selectedOptionIndex,
        amount: Number(amount),
        price: Number(price),
        orderType: 'market'
      };
      const res = await axios.post('/api/trades', payload);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['poll-detail', id]);
        queryClient.invalidateQueries(['trades', id]);
        setAmount('');
      }
    }
  );

  const poll = data?.poll;
  const [liveOrderBook, setLiveOrderBook] = useState(data?.orderBook || null);
  const [liveTrades, setLiveTrades] = useState(data?.tradeHistory || []);
  const [justResolved, setJustResolved] = useState(null); // winningOption index

  const timeRemaining = useMemo(() => {
    if (!poll) return '';
    const now = new Date();
    const end = new Date(poll.endDate);
    const diff = end - now;
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [poll]);

  useEffect(() => {
    if (!id) return;
    const url = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    const socket = io(url, { transports: ['websocket'] });
    socket.emit('join-poll', id);
    socket.on('trade-updated', (payload) => {
      if (payload?.pollId === id) {
        setLiveOrderBook(payload.orderBook || null);
        // Optimistically prepend new trade if present
        if (payload.trade) {
          setLiveTrades((prev) => [payload.trade, ...prev].slice(0, 50));
        } else {
          // fallback: refetch
          queryClient.invalidateQueries(['poll-detail', id]);
        }
      }
    });
    socket.on('poll-updated', (payload) => {
      if (payload?.pollId === id && payload.poll) {
        // Update local poll fields by invalidating query
        queryClient.setQueryData(['poll-detail', id], (old) => ({ ...(old || {}), poll: payload.poll }));
      }
    });
    socket.on('poll-resolved', (payload) => {
      if (payload?.pollId === id) {
        queryClient.setQueryData(['poll-detail', id], (old) => ({ ...(old || {}), poll: { ...(old?.poll || {}), isResolved: true, winningOption: payload.winningOption } }));
        setJustResolved(payload.winningOption);
        const opt = (data?.poll?.options || [])[payload.winningOption]?.text || `Option ${payload.winningOption}`;
        toast.success(`Market resolved. Winner: ${opt}`);
      }
    });
    return () => {
      socket.emit('leave-poll', id);
      socket.disconnect();
    };
  }, [id, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Failed to load poll</h2>
          <p className="text-gray-600 dark:text-gray-400">Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs font-medium rounded">
                  {poll.category}
                </span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded">
                  {poll.subCategory}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{poll.title}</h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-3xl">{poll.description}</p>
            </div>
            <div className="text-right min-w-[160px]">
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end gap-2">
                <FaClock className="w-4 h-4" />
                <span>{timeRemaining}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end gap-2 mt-1">
                <FaChartLine className="w-4 h-4" />
                <span>${poll.totalVolume?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chart, Image, Options & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Advanced chart */}
          {poll && poll.options && poll.options.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-4">
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">Market Progress</div>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(() => {
                    // Build chart data from trade history
                    const all = (liveTrades.length ? liveTrades : data?.tradeHistory) || [];
                    const grouped = {};
                    all.slice().reverse().forEach((t) => {
                      const minute = new Date(t.createdAt);
                      minute.setSeconds(0, 0);
                      const key = minute.toISOString();
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(t);
                    });
                    const optionVolumes = Array.from({ length: poll.options.length }, () => 1);
                    const points = [];
                    const keys = Object.keys(grouped).sort();
                    keys.forEach((k) => {
                      const tradesAt = grouped[k];
                      tradesAt.forEach((t) => {
                        optionVolumes[t.optionIndex] += t.amount;
                      });
                      const total = optionVolumes.reduce((s, v) => s + v, 0);
                      const point = { time: new Date(k).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                      poll.options.forEach((opt, idx) => {
                        point[`o${idx}`] = Math.round((optionVolumes[idx] / total) * 100);
                      });
                      points.push(point);
                    });
                    return points;
                  })()} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#37415120" />
                    <XAxis dataKey="time" tick={{ fill: '#9CA3AF' }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF' }} />
                    <Tooltip />
                    <Legend />
                    {poll.options.map((opt, idx) => (
                      <Line key={idx} type="monotone" dataKey={`o${idx}`} name={opt.text} stroke={['#3B82F6','#F59E0B','#10B981','#EF4444','#8B5CF6','#EC4899'][idx % 6]} dot={false} strokeWidth={2} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {poll.image && (
            <img src={poll.image} alt={poll.title} className="w-full h-64 object-cover rounded-lg" />
          )}

          {/* Options */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Options</h3>
            <div className="space-y-3">
              {poll.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOptionIndex(idx)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    selectedOptionIndex === idx
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/40'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-gray-900 dark:text-gray-100">{opt.text}</span>
                  <span className="text-gray-900 dark:text-gray-100 font-semibold">{opt.percentage}%</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trade history */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Trades</h3>
            {liveTrades.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No trades yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Side</th>
                      <th className="py-2 pr-4">Option</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveTrades.slice(0, 15).map((t) => (
                      <tr key={t._id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{new Date(t.createdAt).toLocaleString()}</td>
                        <td className={`py-2 pr-4 ${t.type === 'buy' ? 'text-emerald-600' : 'text-red-500'}`}>{t.type.toUpperCase()}</td>
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{poll.options[t.optionIndex]?.text || t.optionIndex}</td>
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{t.amount}</td>
                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{t.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Comments */}
          <CommentsSection pollId={poll._id} />
        </div>

        {/* Right: Trading panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trade</h3>
              <div className="inline-flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSide('buy')}
                  className={`px-3 py-1 text-sm ${side === 'buy' ? 'bg-emerald-600 text-white' : 'bg-transparent text-gray-700 dark:text-gray-300'}`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setSide('sell')}
                  className={`px-3 py-1 text-sm ${side === 'sell' ? 'bg-red-600 text-white' : 'bg-transparent text-gray-700 dark:text-gray-300'}`}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* Option selector */}
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Option</label>
            <div className="space-y-2 mb-4">
              {poll.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOptionIndex(idx)}
                  className={`w-full flex items-center justify-between p-3 rounded border text-sm ${
                    selectedOptionIndex === idx
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/40 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>{opt.text}</span>
                  <span className="font-semibold">{opt.percentage}%</span>
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Price (0-1)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.50"
                  className="input w-full"
                />
              </div>
              <button
                onClick={() => tradeMutation.mutate()}
                disabled={!amount || Number(amount) <= 0 || tradeMutation.isLoading}
                className={`w-full ${side === 'buy' ? 'btn-primary' : 'btn-danger'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {tradeMutation.isLoading ? 'Placing order...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${poll.options[selectedOptionIndex]?.text || ''}`}
              </button>
            </div>

            {/* Order book (if available) */}
            {(liveOrderBook || data?.orderBook) && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Order Book</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-emerald-600 mb-1">Buys</div>
                    <div className="space-y-1">
                      {(liveOrderBook || data?.orderBook)?.buyOrders?.map((o) => (
                        <div key={o._id} className="flex justify-between text-gray-700 dark:text-gray-300">
                          <span>{o.amount}</span>
                          <span>{o.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-red-500 mb-1">Sells</div>
                    <div className="space-y-1">
                      {(liveOrderBook || data?.orderBook)?.sellOrders?.map((o) => (
                        <div key={o._id} className="flex justify-between text-gray-700 dark:text-gray-300">
                          <span>{o.amount}</span>
                          <span>{o.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollDetail;
