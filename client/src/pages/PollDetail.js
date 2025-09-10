import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "react-query";
import axios from "../setupAxios";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { FaChartLine, FaClock } from "react-icons/fa";
import Redeem from "../components/layout/Redeem";
import { BACKEND_URL } from "../contexts/Bakendurl";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import CommentsSection from "../components/comments/CommentsSection";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

const PollDetail = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [side, setSide] = useState("buy");
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("0.5");

  const { data, isLoading, error } = useQuery(
    ["poll-detail", id],
    async () => {
      const response = await axios.get(`${BACKEND_URL}/api/polls/${id}`);
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
        orderType: "market",
      };
      const res = await axios.post(`${BACKEND_URL}/api/trades`, payload);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["poll-detail", id]);
        queryClient.invalidateQueries(["trades", id]);
        setAmount("");
      },
    }
  );

  const poll = data?.poll;
  const [liveOrderBook, setLiveOrderBook] = useState(data?.orderBook || null);
  const [liveTrades, setLiveTrades] = useState(data?.tradeHistory || []);
  // remove unused justResolved
  const [claimed, setClaimed] = useState(false);
  // static contract data (temporary placeholder until we read from chain)
  const [contractData] = useState({
    outcome: "Yes",
    optionPool: { yes: 200, no: 300 },
    optionBalance: { yes: 15, no: 13 },
    pool: 500,
    rewardClaimed: false,
  });

  // user's trades on this poll
  const userTrades = useMemo(() => {
    if (!user || !liveTrades) return [];
    return liveTrades.filter(
      (t) => t.user === user._id || (t.user && t.user._id === user._id)
    );
  }, [user, liveTrades]);

  // determine if user has winning trade by comparing DB trades and contract outcome
  const didUserWin = useMemo(() => {
    if (!userTrades.length) return false;
    // try to map contract outcome string to an option index
    const outcomeStr = (contractData?.outcome || "").toString().toLowerCase();
    const contractIdx = poll?.options?.findIndex((o) =>
      o.text?.toLowerCase().includes(outcomeStr)
    );
    // if poll is resolved and winningOption exists, prefer that
    const winningIdx =
      typeof poll?.winningOption === "number"
        ? poll.winningOption
        : contractIdx;
    if (typeof winningIdx !== "number" || winningIdx < 0) return false;
    return userTrades.some((t) => t.optionIndex === winningIdx);
  }, [userTrades, poll, contractData]);

  // keep liveTrades in sync when server data changes (fix: trades disappear after refresh)
  useEffect(() => {
    setLiveTrades(data?.tradeHistory || []);
  }, [data?.tradeHistory]);

  const isEnded = useMemo(() => {
    if (!poll) return false;
    const now = new Date();
    return !poll.isResolved && new Date(poll.endDate) <= now;
  }, [poll]);

  const formatCurrency = (n) =>
    typeof n === "number" ? `$${n.toLocaleString()}` : n;

  useEffect(() => {
    if (!user || !poll?.isResolved) return;
    axios
      .get(`${BACKEND_URL}/api/trades/claimed/${poll._id}`)
      .then((res) => setClaimed(!!res.data.claimed))
      .catch(() => setClaimed(false));
  }, [user, poll]);

  // Log contract data and backend-derived trade info for debugging/inspection
  useEffect(() => {
    console.groupCollapsed(`Poll ${poll?._id} - contract vs backend`);
    console.log("contractData:", contractData);
    console.log("poll (backend):", poll);
    console.log("userTrades:", userTrades);
    console.log("liveTrades (sample):", liveTrades.slice(0, 10));
    console.groupEnd();
  }, [contractData, poll, userTrades, liveTrades]);

  const redeemMutation = useMutation(
    async () => {
      const res = await axios.post(`${BACKEND_URL}/api/trades/redeem`, {
        pollId: poll._id,
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        setClaimed(true);
        // Update user in auth context by invalidating /me or refetching
        queryClient.invalidateQueries(["me"]);
        toast.success(`Claimed $${data.amount}`);
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || "Redeem failed");
      },
    }
  );

  const timeRemaining = useMemo(() => {
    if (!poll) return "";
    const now = new Date();
    const end = new Date(poll.endDate);
    const diff = end - now;
    if (diff <= 0) return "Ended";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [poll]);

  useEffect(() => {
    if (!id) return;
    const url = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
    const socket = io(url, { transports: ["websocket"] });
    socket.emit("join-poll", id);
    socket.on("trade-updated", (payload) => {
      if (payload?.pollId === id) {
        setLiveOrderBook(payload.orderBook || null);
        // Optimistically prepend new trade if present
        if (payload.trade) {
          setLiveTrades((prev) => [payload.trade, ...prev].slice(0, 50));
        } else {
          // fallback: refetch
          queryClient.invalidateQueries(["poll-detail", id]);
        }
      }
    });
    socket.on("poll-updated", (payload) => {
      if (payload?.pollId === id && payload.poll) {
        // Update local poll fields by invalidating query
        queryClient.setQueryData(["poll-detail", id], (old) => ({
          ...(old || {}),
          poll: payload.poll,
        }));
      }
    });
    socket.on("poll-resolved", (payload) => {
      if (payload?.pollId === id) {
        queryClient.setQueryData(["poll-detail", id], (old) => ({
          ...(old || {}),
          poll: {
            ...(old?.poll || {}),
            isResolved: true,
            winningOption: payload.winningOption,
          },
        }));
        const opt =
          (data?.poll?.options || [])[payload.winningOption]?.text ||
          `Option ${payload.winningOption}`;
        toast.success(`Market resolved. Winner: ${opt}`);
      }
    });
    return () => {
      socket.emit("leave-poll", id);
      socket.disconnect();
    };
  }, [id, queryClient, data?.poll?.options]);

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Failed to load poll
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please try again later.
          </p>
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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {poll.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-3xl">
                {poll.description}
              </p>
            </div>
            <div className="text-right min-w-[160px]">
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end gap-2">
                <FaClock className="w-4 h-4" />
                <span>{timeRemaining}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end gap-2 mt-1">
                <FaChartLine className="w-4 h-4" />
                <span>${poll.totalVolume?.toLocaleString() || "0"}</span>
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
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Market Progress
              </div>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {/* ...existing chart code... */}
                  <LineChart
                    data={(() => {
                      // ...existing code...
                      const all =
                        (liveTrades.length ? liveTrades : data?.tradeHistory) ||
                        [];
                      const grouped = {};
                      all
                        .slice()
                        .reverse()
                        .forEach((t) => {
                          const minute = new Date(t.createdAt);
                          minute.setSeconds(0, 0);
                          const key = minute.toISOString();
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(t);
                        });
                      const optionVolumes = Array.from(
                        { length: poll.options.length },
                        () => 1
                      );
                      const points = [];
                      const keys = Object.keys(grouped).sort();
                      keys.forEach((k) => {
                        const tradesAt = grouped[k];
                        tradesAt.forEach((t) => {
                          optionVolumes[t.optionIndex] += t.amount;
                        });
                        const total = optionVolumes.reduce((s, v) => s + v, 0);
                        const point = {
                          time: new Date(k).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                        };
                        poll.options.forEach((opt, idx) => {
                          point[`o${idx}`] = Math.round(
                            (optionVolumes[idx] / total) * 100
                          );
                        });
                        points.push(point);
                      });
                      return points;
                    })()}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#37415120" />
                    <XAxis dataKey="time" tick={{ fill: "#9CA3AF" }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#9CA3AF" }} />
                    <Tooltip />
                    <Legend />
                    {poll.options.map((opt, idx) => (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey={`o${idx}`}
                        name={opt.text}
                        stroke={
                          [
                            "#3B82F6",
                            "#F59E0B",
                            "#10B981",
                            "#EF4444",
                            "#8B5CF6",
                            "#EC4899",
                          ][idx % 6]
                        }
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {poll.image && (
            <img
              src={poll.image}
              alt={poll.title}
              className="w-full h-64 object-cover rounded-lg"
            />
          )}

          {/* Options */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Options
            </h3>
            <div className="space-y-3">
              {poll.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOptionIndex(idx)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    selectedOptionIndex === idx
                      ? "border-primary-400 bg-yellow-600 dark:bg-primary-950/40"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-gray-900 dark:text-gray-100">
                    {opt.text}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-semibold">
                    {opt.percentage}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Trade panel: show after options for small screens */}
          <div className="block lg:hidden">
            {/* If poll resolved, show redeem/lose/ended logic; otherwise show trade panel */}
            {poll.isResolved ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 mt-6">
                <Redeem
                  contractData={contractData}
                  user={user}
                  userTrades={userTrades}
                  poll={poll}
                  isEnded={isEnded}
                  didUserWin={didUserWin}
                  redeemMutation={redeemMutation}
                  claimed={claimed}
                  formatCurrency={formatCurrency}
                />
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 mt-6">
                {/* ...existing mobile trade panel preserved... */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Trade
                  </h3>
                  <div className="inline-flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setSide("buy")}
                      className={`px-3 py-1 text-sm ${
                        side === "buy"
                          ? "bg-emerald-600 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => setSide("sell")}
                      className={`px-3 py-1 text-sm ${
                        side === "sell"
                          ? "bg-red-600 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Sell
                    </button>
                  </div>
                </div>

                {/* Option selector */}
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Option
                </label>
                <div className="space-y-2 mb-4">
                  {poll.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOptionIndex(idx)}
                      className={`w-full flex items-center justify-between p-3 rounded border text-sm ${
                        selectedOptionIndex === idx
                          ? "border-primary-400 bg-yellow-600 dark:bg-primary-950/40 text-gray-900 dark:text-gray-100"
                          : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
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
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Amount
                    </label>
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
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Price (0-1)
                    </label>
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
                    disabled={
                      !amount || Number(amount) <= 0 || tradeMutation.isLoading
                    }
                    className={`w-full ${
                      side === "buy" ? "btn-primary" : "btn-danger"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {tradeMutation.isLoading
                      ? "Placing order..."
                      : `${side === "buy" ? "Buy" : "Sell"} ${
                          poll.options[selectedOptionIndex]?.text || ""
                        }`}
                  </button>
                </div>

                {/* Order book (if available) */}
                {(liveOrderBook || data?.orderBook) && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Order Book
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-emerald-600 mb-1">Buys</div>
                        <div className="space-y-1">
                          {(liveOrderBook || data?.orderBook)?.buyOrders?.map(
                            (o) => (
                              <div
                                key={o._id}
                                className="flex justify-between text-gray-700 dark:text-gray-300"
                              >
                                <span>{o.amount}</span>
                                <span>{o.price}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-red-500 mb-1">Sells</div>
                        <div className="space-y-1">
                          {(liveOrderBook || data?.orderBook)?.sellOrders?.map(
                            (o) => (
                              <div
                                key={o._id}
                                className="flex justify-between text-gray-700 dark:text-gray-300"
                              >
                                <span>{o.amount}</span>
                                <span>{o.price}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trade history */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Recent Trades
            </h3>

            {liveTrades.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No trades yet.
              </p>
            ) : (
              <>
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
                        <tr
                          key={t._id}
                          className="border-t border-gray-100 dark:border-gray-700"
                        >
                          <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                            {new Date(t.createdAt).toLocaleString()}
                          </td>
                          <td
                            className={`py-2 pr-4 ${
                              t.type === "buy"
                                ? "text-emerald-600"
                                : "text-red-500"
                            }`}
                          >
                            {t.type.toUpperCase()}
                          </td>
                          <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                            {poll.options[t.optionIndex]?.text || t.optionIndex}
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
              </>
            )}
          </div>

          {/* Comments */}
          <CommentsSection pollId={poll._id} />
        </div>

        {/* Right: Trading panel for large screens */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 sticky top-24">
            {/* contract outcome */}

            {/* If poll is resolved, show redeem/lose/ended logic; otherwise show trade panel */}
            {poll.isResolved ? (
              <Redeem
                contractData={contractData}
                user={user}
                userTrades={userTrades}
                poll={poll}
                isEnded={isEnded}
                didUserWin={didUserWin}
                redeemMutation={redeemMutation}
                claimed={claimed}
                formatCurrency={formatCurrency}
              />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Trade
                  </h3>
                  <div className="inline-flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setSide("buy")}
                      className={`px-3 py-1 text-sm ${
                        side === "buy"
                          ? "bg-emerald-600 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => setSide("sell")}
                      className={`px-3 py-1 text-sm ${
                        side === "sell"
                          ? "bg-red-600 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Sell
                    </button>
                  </div>
                </div>

                {/* Option selector */}
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Option
                </label>
                <div className="space-y-2 mb-4">
                  {poll.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOptionIndex(idx)}
                      className={`w-full flex items-center justify-between p-3 rounded border text-sm ${
                        selectedOptionIndex === idx
                          ? "border-primary-400 bg-yellow-600 dark:bg-primary-950/40 text-gray-900 dark:text-gray-100"
                          : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
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
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Amount
                    </label>
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
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Price (0-1)
                    </label>
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
                    disabled={
                      !amount || Number(amount) <= 0 || tradeMutation.isLoading
                    }
                    className={`w-full ${
                      side === "buy" ? "btn-primary" : "btn-danger"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {tradeMutation.isLoading
                      ? "Placing order..."
                      : `${side === "buy" ? "Buy" : "Sell"} ${
                          poll.options[selectedOptionIndex]?.text || ""
                        }`}
                  </button>
                </div>

                {/* Order book (if available) */}
                {(liveOrderBook || data?.orderBook) && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Order Book
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-emerald-600 mb-1">Buys</div>
                        <div className="space-y-1">
                          {(liveOrderBook || data?.orderBook)?.buyOrders?.map(
                            (o) => (
                              <div
                                key={o._id}
                                className="flex justify-between text-gray-700 dark:text-gray-300"
                              >
                                <span>{o.amount}</span>
                                <span>{o.price}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-red-500 mb-1">Sells</div>
                        <div className="space-y-1">
                          {(liveOrderBook || data?.orderBook)?.sellOrders?.map(
                            (o) => (
                              <div
                                key={o._id}
                                className="flex justify-between text-gray-700 dark:text-gray-300"
                              >
                                <span>{o.amount}</span>
                                <span>{o.price}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollDetail;
