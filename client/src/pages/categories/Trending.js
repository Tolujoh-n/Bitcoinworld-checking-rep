import React, { useMemo, useState } from "react";
import { useQuery } from "react-query";
import axios from "../../setupAxios";
import PollCard from "../../components/polls/PollCard";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { BACKEND_URL } from "../../contexts/Bakendurl";

const Trending = () => {
  const [sort, setSort] = useState("volume");

  const { data, isLoading, error } = useQuery(
    ["trending"],
    async () => {
      const res = await axios.get(`${BACKEND_URL}/api/polls/trending?limit=60`);
      return res.data;
    },
    { staleTime: 60 * 1000 }
  );

  const sorted = useMemo(() => {
    const list = data || [];
    if (sort === "volume")
      return [...list].sort((a, b) => (b.totalVolume || 0) - (a.totalVolume || 0));
    if (sort === "trades")
      return [...list].sort((a, b) => (b.totalTrades || 0) - (a.totalTrades || 0));
    return list;
  }, [data, sort]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                Trending
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Most active markets by volume and trades
              </p>
            </div>
            <div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="input"
              >
                <option value="volume">Sort by Volume</option>
                <option value="trades">Sort by Trades</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">
            Failed to load trending.
          </div>
        ) : (
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
            {sorted.map((poll) => (
              <PollCard key={poll._id} poll={poll} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Trending;
