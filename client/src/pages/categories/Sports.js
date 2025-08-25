import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import axios from '../../setupAxios';

const SPORTS = ['Football', 'Basketball', 'Baseball', 'Soccer', 'Tennis', 'Golf', 'Boxing', 'MMA', 'Olympics'];

const Sports = () => {
  const [selectedSport, setSelectedSport] = useState('Football');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: pollsData, isLoading } = useQuery(
    ['polls', 'Sports', selectedSport, currentPage],
    async () => {
      const params = new URLSearchParams({ category: 'Sports', subCategory: selectedSport, page: currentPage, limit: 10, sort: 'createdAt', order: 'desc' });
      const res = await axios.get(`/api/polls?${params}`);
      return res.data;
    },
    { keepPreviousData: true, staleTime: 60 * 1000 }
  );

  const clubs = useMemo(() => {
    const arr = [];
    (pollsData?.polls || []).forEach((p) => {
      if (p.team1?.name) arr.push({ name: p.team1.name, logo: p.team1.logo });
      if (p.team2?.name) arr.push({ name: p.team2.name, logo: p.team2.logo });
    });
    const dedup = new Map();
    arr.forEach((c) => { if (!dedup.has(c.name)) dedup.set(c.name, c); });
    return Array.from(dedup.values()).slice(0, 20);
  }, [pollsData]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Horizontal scroll filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {SPORTS.map((s) => (
              <button
                key={s}
                onClick={() => { setSelectedSport(s); setCurrentPage(1); }}
                className={`min-w-[220px] rounded-lg p-4 border text-left relative ${
                  selectedSport === s ? 'border-primary-400 bg-yellow-600 dark:bg-primary-950/40' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Box content */}
                <div className="text-xs text-gray-500 absolute top-2 right-2">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-xs text-gray-500">Vol: ${pollsData?.polls?.[0]?.totalVolume?.toLocaleString() || 0}</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-gray-300 rounded-full" />
                      <div className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[120px]">{pollsData?.polls?.[0]?.team1?.name || 'Team A'}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pollsData?.polls?.[0]?.team1?.odds ?? '-'}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-gray-300 rounded-full" />
                      <div className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[120px]">{pollsData?.polls?.[0]?.team2?.name || 'Team B'}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pollsData?.polls?.[0]?.team2?.odds ?? '-'}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Side nav clubs */}
        <aside className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft p-4 h-fit">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Clubs</h3>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-2">
            {clubs.map((c) => (
              <div key={c.name} className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-700">
                {c.logo ? <img src={c.logo} alt={c.name} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-gray-300 rounded-full" />}
                <span className="text-sm text-gray-700 dark:text-gray-300">{c.name}</span>
              </div>
            ))}
            {clubs.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-400">No clubs loaded</div>}
          </div>
        </aside>

        {/* Column 2: Main list */}
        <section className="lg:col-span-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Live</h3>
          {(pollsData?.polls || []).slice(0, 3).map((p) => (
            <div key={p._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">{new Date(p.matchTime || p.endDate).toLocaleString()} • Vol ${p.totalVolume?.toLocaleString() || 0}</div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      {p.team1?.logo ? <img src={p.team1.logo} alt={p.team1.name} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-gray-300 rounded-full" />}
                      <span className="text-gray-900 dark:text-gray-100">{p.team1?.name || 'Team A'}</span>
                    </div>
                    <span className="text-gray-900 dark:text-gray-100 font-semibold">{p.team1?.odds ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      {p.team2?.logo ? <img src={p.team2.logo} alt={p.team2.name} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-gray-300 rounded-full" />}
                      <span className="text-gray-900 dark:text-gray-100">{p.team2?.name || 'Team B'}</span>
                    </div>
                    <span className="text-gray-900 dark:text-gray-100 font-semibold">{p.team2?.odds ?? '-'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/poll/${p._id}`} className="btn-primary btn-sm">Buy</a>
                <a href={`/poll/${p._id}`} className="btn-outline btn-sm">Sell</a>
              </div>
            </div>
          ))}

          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mt-6">Starting Soon</h3>
          {(pollsData?.polls || []).slice(3, 8).map((p) => (
            <div key={p._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">{new Date(p.matchTime || p.endDate).toLocaleString()} • Vol ${p.totalVolume?.toLocaleString() || 0}</div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      {p.team1?.logo ? <img src={p.team1.logo} alt={p.team1.name} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-gray-300 rounded-full" />}
                      <span className="text-gray-900 dark:text-gray-100">{p.team1?.name || 'Team A'}</span>
                    </div>
                    <span className="text-gray-900 dark:text-gray-100 font-semibold">{p.team1?.odds ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      {p.team2?.logo ? <img src={p.team2.logo} alt={p.team2.name} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-gray-300 rounded-full" />}
                      <span className="text-gray-900 dark:text-gray-100">{p.team2?.name || 'Team B'}</span>
                    </div>
                    <span className="text-gray-900 dark:text-gray-100 font-semibold">{p.team2?.odds ?? '-'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/poll/${p._id}`} className="btn-primary btn-sm">Buy</a>
                <a href={`/poll/${p._id}`} className="btn-outline btn-sm">Sell</a>
              </div>
            </div>
          ))}
        </section>

        {/* Column 3: Aside trading widget */}
        <aside className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft p-4 h-fit">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gray-300 rounded-full" />
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Match</div>
              <div className="text-xs text-gray-500">Team A vs Team B</div>
            </div>
          </div>
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button className="px-3 py-2 text-sm border-b-2 border-primary-600 text-primary-600">Buy</button>
            <button className="px-3 py-2 text-sm text-gray-500">Sell</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button className="btn-outline">Team A</button>
            <button className="btn-outline">Team B</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Amount</label>
              <input type="number" className="input w-full" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Price (0-1)</label>
              <input type="number" className="input w-full" placeholder="0.50" />
            </div>
            <button className="btn-primary w-full">Trade</button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Sports;
