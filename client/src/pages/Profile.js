import React, { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useQuery } from "react-query";
import axios from "../setupAxios";
import PollCard from "../components/polls/PollCard";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { BACKEND_URL } from "../contexts/Bakendurl";

const Profile = () => {
  const { user } = useAuth();

  const { data: saved, isLoading: loadingSaved } = useQuery(
    ["saved-polls"],
    async () => (await axios.get(`${BACKEND_URL}/api/polls/user/saved`)).data
  );
  const { data: trades, isLoading: loadingTrades } = useQuery(
    ["my-trades"],
    async () => (await axios.get(`${BACKEND_URL}/api/trades/user`)).data
  );

  // Traded polls filter state
  const [tradeFilter, setTradeFilter] = useState("Active");

  // Derive unique polls from trades (some trades may reference same poll)
  const tradedPolls = useMemo(() => {
    const list = (trades?.trades || []).map((t) => t.poll).filter(Boolean);
    const map = {};
    list.forEach((p) => {
      if (!p || !p._id) return;
      if (!map[p._id]) map[p._id] = p;
    });
    return Object.values(map);
  }, [trades]);

  const filteredTradedPolls = useMemo(() => {
    const now = new Date();
    switch (tradeFilter) {
      case "Active":
        return tradedPolls.filter(
          (p) => !p.isResolved && new Date(p.endDate) > now
        );
      case "Ended":
        return tradedPolls.filter(
          (p) => !p.isResolved && new Date(p.endDate) <= now
        );
      case "Resolved":
        return tradedPolls.filter((p) => p.isResolved);
      default:
        return tradedPolls;
    }
  }, [tradeFilter, tradedPolls]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-300 overflow-hidden">
            {user?.avatar && (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {user?.username}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Balance: ${user?.balance?.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Saved polls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Saved Polls
          </h2>
          {loadingSaved ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(saved || []).map((p) => (
                <PollCard key={p._id} poll={p} />
              ))}
            </div>
          )}
        </div>

        {/* Traded polls: quick access area */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Traded Polls
            </h2>
            <div className="inline-flex bg-gray-100 dark:bg-gray-700 rounded-md p-1">
              {["Active", "Ended", "Resolved"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTradeFilter(t)}
                  className={`px-3 py-1 text-sm ${
                    tradeFilter === t
                      ? "bg-white dark:bg-gray-800 shadow"
                      : "bg-transparent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loadingTrades ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(filteredTradedPolls || []).map((p) => (
                <PollCard key={p._id} poll={p} />
              ))}
              {(!filteredTradedPolls || filteredTradedPolls.length === 0) && (
                <div className="text-sm text-gray-500">
                  No traded polls found for this filter.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trade history */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            My Trades
          </h2>
          {loadingTrades ? (
            <LoadingSpinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Poll</th>
                    <th className="py-2 pr-4">Side</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(trades?.trades || []).map((t) => (
                    <tr
                      key={t._id}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                        {t.poll?.title || "-"}
                      </td>
                      <td
                        className={`py-2 pr-4 ${
                          t.type === "buy" ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {t.type.toUpperCase()}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                        {t.amount}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                        {t.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
