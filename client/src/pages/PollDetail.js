import React, { useEffect, useMemo, useState, useRef } from "react";
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
import toast from "react-hot-toast";
import {
  getPool,
  getOutcome,
  getYesSupply,
  getNoSupply,
  getYesBalance,
  getNoBalance,
  buyYes,
  buyNo,
  sellYes,
  sellNo,
  buyYesAuto,
  buyNoAuto,
  sellYesAuto,
  sellNoAuto,
  buyYesAutoSmart,
  buyNoAutoSmart,
  sellYesAutoSmart,
  sellNoAutoSmart,
  redeem as redeemOnChain,
  pollTx,
} from "../contexts/stacks/marketClient";

// Small numeric input with inc/dec
const NumberInput = ({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  placeholder = "0.00",
  disabled = false,
  className = "",
  readOnly = false,
}) => {
  const parse = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const clamp = (n) => {
    if (typeof max === "number") n = Math.min(n, max);
    if (typeof min === "number") n = Math.max(n, min);
    return n;
  };
  const inc = () => {
    if (readOnly || disabled) return;
    onChange(String(clamp(parse(value || 0) + step)));
  };
  const dec = () => {
    if (readOnly || disabled) return;
    onChange(String(clamp(parse(value || 0) - step)));
  };

  return (
    <div className={`number-wrap ${disabled ? "opacity-60" : ""}`}>
      <input
        type="text"
        inputMode="decimal"
        className={`input number-input ${className}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
      />
      <div className="number-steps">
        <button
          type="button"
          className="number-step"
          aria-label="Increase"
          onClick={inc}
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3">
            <path
              d="M6 14l6-6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </button>
        <button
          type="button"
          className="number-step"
          aria-label="Decrease"
          onClick={dec}
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3">
            <path
              d="M6 10l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default function PollDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Local UI state
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  const [contractLoading, setContractLoading] = useState(false);
  const [contractData, setContractData] = useState({
    outcome: "",
    optionPool: { yes: 0, no: 0 },
    optionBalance: { yes: 0, no: 0 },
    pool: 0,
    yesSupply: 0,
    noSupply: 0,
  });
  const [liveOrderBook, setLiveOrderBook] = useState(null);
  const [liveTrades, setLiveTrades] = useState([]);
  const [claimed, setClaimed] = useState(false);

  // Fetch poll data
  const { data, isLoading, error } = useQuery(
    ["poll-detail", id],
    async () => (await axios.get(`${BACKEND_URL}/api/polls/${id}`)).data,
    { staleTime: 60 * 1000 }
  );

  const poll = data?.poll || data;

  useEffect(() => {
    setLiveTrades(data?.tradeHistory || []);
    setLiveOrderBook(data?.orderBook || null);
  }, [data?.tradeHistory, data?.orderBook]);

  // Fetch global market status (paused?)
  const { data: marketStatus } = useQuery(
    ["market-status"],
    async () => (await axios.get(`${BACKEND_URL}/api/market/status`)).data,
    { staleTime: 10 * 1000 }
  );

  // Read on-chain contract data periodically
  useEffect(() => {
    let mounted = true;
    async function fetchContract() {
      if (!poll?.marketId) return;
      const marketId = Number(poll.marketId);
      setContractLoading(true);
      try {
        const [poolRes, outcomeRes, yesSupplyRes, noSupplyRes] = await Promise.all([
          getPool(marketId),
          getOutcome(marketId),
          getYesSupply(marketId),
          getNoSupply(marketId),
        ]);

        const mapNum = (r) => {
          if (r == null) return 0;
          if (typeof r === "number") return r;
          if (r.value && typeof r.value === "number") return r.value;
          if (r.value?.toString) return Number(r.value.toString());
          return Number(r.toString?.() || 0);
        };

        const pool = mapNum(poolRes);
        const yesSupply = mapNum(yesSupplyRes);
        const noSupply = mapNum(noSupplyRes);
        const outcome = outcomeRes?.value || outcomeRes || "";

        if (mounted) {
          setContractData({
            outcome,
            optionPool: {
              yes: pool * (yesSupply / (yesSupply + noSupply || 1)),
              no: pool * (noSupply / (yesSupply + noSupply || 1)),
            },
            optionBalance: { yes: 0, no: 0 },
            pool,
            yesSupply,
            noSupply,
          });
        }
      } catch (e) {
        // noop
      } finally {
        if (mounted) setContractLoading(false);
      }
    }
    fetchContract();
    const i = setInterval(fetchContract, 15000);
    return () => {
      mounted = false;
      clearInterval(i);
    };
  }, [poll]);

  const userTrades = useMemo(() => {
    if (!user || !liveTrades) return [];
    return liveTrades.filter((t) => t.user === user._id || (t.user && t.user._id === user._id));
  }, [user, liveTrades]);

  const didUserWin = useMemo(() => {
    if (!userTrades.length) return false;
    const outcomeStr = (contractData?.outcome || "").toString().toLowerCase();
    const contractIdx = poll?.options?.findIndex((o) => o.text?.toLowerCase().includes(outcomeStr));
    const winningIdx = typeof poll?.winningOption === "number" ? poll.winningOption : contractIdx;
    if (typeof winningIdx !== "number" || winningIdx < 0) return false;
    return userTrades.some((t) => t.optionIndex === winningIdx);
  }, [userTrades, poll, contractData]);

  const isEnded = useMemo(() => {
    if (!poll) return false;
    return !poll.isResolved && new Date(poll.endDate) <= new Date();
  }, [poll]);

  const formatCurrency = (n) => (typeof n === "number" ? `$${n.toLocaleString()}` : n);

  useEffect(() => {
    if (!user || !poll?.isResolved) return;
    axios
      .get(`${BACKEND_URL}/api/trades/claimed/${poll._id}`)
      .then((res) => setClaimed(!!res.data.claimed))
      .catch(() => setClaimed(false));
  }, [user, poll]);

  // Trade mutation (wraps on-chain + backend)
  const tradeMutation = useMutation(
    async () => {
      const payload = {
        pollId: id,
        type: side,
        optionIndex: selectedOptionIndex,
        amount: Number(amount),
        price: Number(price),
        orderType,
      };

      const selectedOptionText = (poll?.options?.[selectedOptionIndex]?.text || "").toString().toLowerCase().trim();
      const isYes = selectedOptionText.includes("yes") || selectedOptionIndex === 0;

      if (!poll?.marketId) throw new Error("Missing marketId");
      const marketId = Number(poll.marketId);

      let txResult = null;
      const amt = Math.ceil(Number(amount) || 0);

      if (orderType === "market") {
        const isFirst = !liveTrades || liveTrades.length === 0;
        if (side === "buy") {
          txResult = isYes
            ? isFirst
              ? await buyYesAutoSmart(marketId, amt)
              : await buyYes(marketId, amt)
            : isFirst
            ? await buyNoAutoSmart(marketId, amt)
            : await buyNo(marketId, amt);
        } else {
          txResult = isYes
            ? isFirst
              ? await sellYesAutoSmart(marketId, amt)
              : await sellYes(marketId, amt)
            : isFirst
            ? await sellNoAutoSmart(marketId, amt)
            : await sellNo(marketId, amt);
        }
      } else {
        // For limit orders, we still need to calculate cap and cost manually
        const cap = Math.max(amt * 10, 1);
        const cost = Math.max(Math.ceil(amt * Number(price)), 1);
        if (side === "buy") {
          txResult = isYes ? await buyYesAuto(marketId, amt, cap, cost) : await buyNoAuto(marketId, amt, cap, cost);
        } else {
          txResult = isYes ? await sellYesAuto(marketId, amt, cap, cost) : await sellNoAuto(marketId, amt, cap, cost);
        }
      }

      const txId = txResult?.txId || txResult?.tx_id || txResult?.txid || null;
      if (!txId) throw new Error("No txId");
      await pollTx(txId, 5000, 60);
      payload.txId = txId;

      return (await axios.post(`${BACKEND_URL}/api/trades`, payload)).data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["poll-detail", id]);
        queryClient.invalidateQueries(["trades", id]);
        setAmount("");
        toast.success("Trade placed");
      },
      onError: (err) => toast.error(err?.response?.data?.message || err.message || "Trade failed"),
    }
  );

  // Redeem mutation wrapper
  const redeemMutation = useMutation(
    async () => {
      if (!poll?.marketId) throw new Error("Missing marketId");
      const marketId = Number(poll.marketId);
      // call on-chain redeem then notify backend
      const tx = await redeemOnChain(marketId);
      const txId = tx?.txId || tx?.tx_id || tx?.txid || null;
      if (!txId) throw new Error("No txId for redeem");
      await pollTx(txId, 5000, 60);
      await axios.post(`${BACKEND_URL}/api/trades/redeem`, { pollId: id, txId });
      return true;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["poll-detail", id]);
        toast.success("Redeemed");
      },
      onError: (err) => toast.error(err?.response?.data?.message || err.message || "Redeem failed"),
    }
  );

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

  const timeRemaining = (() => {
    try {
      const diff = new Date(poll.endDate) - new Date();
      if (diff <= 0) return "Ended";
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days > 0) return `${days}d left`;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours > 0) return `${hours}h left`;
      const mins = Math.floor(diff / (1000 * 60));
      return `${mins}m left`;
    } catch (e) {
      return "";
    }
  })();

  const marketPrice = (() => {
    // simple derived price from contractData or poll
    try {
      if (contractData && contractData.pool) return ((contractData.optionPool?.yes || 0) / (contractData.pool || 1)) * 100;
      return poll?.options?.[selectedOptionIndex]?.percentage || 0;
    } catch (e) {
      return 0;
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0 flex items-center gap-4">
              <div className="header-thumb header-thumb--lg">
                {poll.image ? (
                  <img src={poll.image} alt={poll.title} className="w-full h-full object-cover rounded-md" />
                ) : (
                  <div className="w-full h-full rounded-md bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="pill">{poll.category}</span>
                  {poll.subCategory && <span className="pill">{poll.subCategory}</span>}
                </div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 text-balance">{poll.title}</h1>
                {poll.description && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{poll.description}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <a href={`/poll/${poll._id}`} className="btn-outline btn-sm" title="Market link">Market link</a>
                  <button className="btn-outline btn-sm">Add to watchlist</button>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-2">
                <FaClock className="w-4 h-4" />
                <span>{timeRemaining}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end gap-2">
                <FaChartLine className="w-4 h-4" />
                <span>${poll.totalVolume?.toLocaleString() || "0"}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Ends</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">{new Date(poll.endDate).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          {poll?.options?.length > 0 && (
            <div className="section-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">Price history</span>
                <div className="tabs ml-auto">
                  {['Day','Week','Month','Year','All'].map((r) => (
                    <button key={r} className={`tab ${r === 'All' ? 'tab-active' : ''}`}>{r}</button>
                  ))}
                </div>
                {contractLoading && <span className="ml-2 text-xs text-gray-500">Reading on-chain…</span>}
              </div>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(() => {
                    const all = (liveTrades.length ? liveTrades : data?.tradeHistory) || [];
                    const grouped = {};
                    all.slice().reverse().forEach((t) => {
                      const minute = new Date(t.createdAt);
                      minute.setSeconds(0,0);
                      const key = minute.toISOString();
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(t);
                    });
                    const optionVolumes = Array.from({ length: poll.options.length }, () => 1);
                    const points = [];
                    const keys = Object.keys(grouped).sort();
                    keys.forEach((k) => {
                      const tradesAt = grouped[k];
                      tradesAt.forEach((t) => { optionVolumes[t.optionIndex] += t.amount; });
                      const total = optionVolumes.reduce((s,v) => s+v, 0);
                      const point = { time: new Date(k).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                      poll.options.forEach((opt, idx) => { point[`o${idx}`] = Math.round((optionVolumes[idx]/total)*100); });
                      points.push(point);
                    });
                    return points;
                  })()} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#37415120" />
                    <XAxis dataKey="time" tick={{ fill: "#9CA3AF" }} />
                    <YAxis domain={[0,100]} tick={{ fill: "#9CA3AF" }} />
                    <Tooltip />
                    <Legend />
                    {poll.options.map((opt, idx) => (
                      <Line key={idx} type="monotone" dataKey={`o${idx}`} name={opt.text} stroke={["#3B82F6","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899"][idx%6]} dot={false} strokeWidth={2} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Options */}
          {marketStatus?.paused ? (
            <div className="section-card p-4 text-center">
              <h3 className="section-title">Market paused</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Market paused, check back soon.</p>
            </div>
          ) : (
            <div className="section-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title">Options</h3>
                <div className="flex items-center gap-2">
                  <div className="tabs">
                    <button onClick={() => setSide("buy")} className={`tab ${side === "buy" ? "tab-active" : ""}`}>Buy</button>
                    <button onClick={() => setSide("sell")} className={`tab ${side === "sell" ? "tab-active" : ""}`}>Sell</button>
                  </div>
                  <div className="tabs">
                    <button onClick={() => setOrderType("market")} className={`tab ${orderType === "market" ? "tab-active" : ""}`}>Market</button>
                    <button onClick={() => setOrderType("limit")} className={`tab ${orderType === "limit" ? "tab-active" : ""}`}>Limit</button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {poll.options.map((opt, idx) => (
                  <div key={idx} className={`option-row grid grid-cols-[1fr_64px_auto_auto] items-center gap-3 ${selectedOptionIndex === idx ? "border-primary-400 bg-yellow-600/10 dark:bg-primary-950/30" : ""}`}>
                    <div className="option-left">
                      <div className="option-icon" />
                      <div className="min-w-0">
                        <div className="option-name">{opt.text}</div>
                      </div>
                    </div>
                    <div className="option-pct">{opt.percentage ?? 0}%</div>
                    <div className="option-cta">
                      <NumberInput value={selectedOptionIndex === idx ? amount : ""} onChange={(v) => { if (selectedOptionIndex !== idx) setSelectedOptionIndex(idx); setAmount(v); }} step={1} min={0} className="w-28 h-9" />
                    </div>
                    <div className="flex justify-end">
                      <button className="btn-primary btn-sm" onClick={() => { if (selectedOptionIndex !== idx) setSelectedOptionIndex(idx); tradeMutation.mutate(); }} disabled={!amount || Number(amount) <= 0 || tradeMutation.isLoading}>
                        {tradeMutation.isLoading ? "…" : "Predict"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {orderType === "market" ? (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">Ref price: <span className="text-gray-900 dark:text-gray-100">{marketPrice}</span></div>
              ) : (
                <div className="mt-3">
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Price</label>
                  <NumberInput value={price} onChange={setPrice} step={0.01} min={0} className="w-40" />
                </div>
              )}
            </div>
          )}

          {/* Resolution */}
          <div className="section-card p-4">
            <h4 className="section-title mb-2">Resolution</h4>
            {poll.resolutionLink && (
              <a href={poll.resolutionLink} className="text-sm text-primary-600 dark:text-primary-400 underline">{poll.resolutionLink}</a>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{poll.resolutionNote || "The market will be resolved based on the linked source."}</p>
          </div>

          {/* Tabs visuales */}
          <div className="flex items-center justify-between mt-6 mb-3">
            <div className="tabs">
              <button className="tab tab-active">Comments</button>
              <button className="tab">Top holders</button>
              <button className="tab">Transactions</button>
            </div>
          </div>

          {/* Historial */}
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
                        <td className={`py-2 pr-4 ${t.type === "buy" ? "text-emerald-600" : "text-red-500"}`}>{t.type.toUpperCase()}</td>
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

          <CommentsSection pollId={poll._id} />
        </div>

        {/* Right column */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6 sticky top-24">
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
            ) : marketStatus?.paused ? (
              <div className="text-center">
                <h3 className="section-title">Market paused</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Market paused, check back soon.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trade</h3>
                  <div className="tabs">
                    <button onClick={() => setSide("buy")} className={`tab ${side === "buy" ? "tab-active" : ""}`}>Buy</button>
                    <button onClick={() => setSide("sell")} className={`tab ${side === "sell" ? "tab-active" : ""}`}>Sell</button>
                  </div>
                </div>

                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Option</label>
                <div className="space-y-2 mb-4">
                  {poll.options.map((opt, idx) => (
                    <button key={idx} onClick={() => setSelectedOptionIndex(idx)} className={`w-full flex items-center justify-between p-3 rounded border text-sm ${selectedOptionIndex === idx ? "border-primary-400 bg-yellow-600 dark:bg-primary-950/40 text-gray-900 dark:text-gray-100" : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"}`}>
                      <span>{opt.text}</span>
                      <span className="font-semibold">{opt.percentage}%</span>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end mb-4">
                  <div className="tabs">
                    <button onClick={() => setOrderType("market")} className={`tab ${orderType === "market" ? "tab-active" : ""}`}>Market</button>
                    <button onClick={() => setOrderType("limit")} className={`tab ${orderType === "limit" ? "tab-active" : ""}`}>Limit</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Amount</label>
                    <NumberInput value={amount} onChange={setAmount} step={1} min={0} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Price</label>
                    {orderType === "market" ? (
                      <NumberInput value={String(marketPrice)} onChange={() => {}} readOnly />
                    ) : (
                      <NumberInput value={price} onChange={setPrice} step={0.01} min={0} />
                    )}
                  </div>
                  <button onClick={() => tradeMutation.mutate()} disabled={!amount || Number(amount) <= 0 || tradeMutation.isLoading} className={`w-full ${side === "buy" ? "btn-primary" : "btn-danger"} disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {tradeMutation.isLoading ? "Placing order..." : `${side === "buy" ? "Buy" : "Sell"} ${poll.options[selectedOptionIndex]?.text || ""}`}
                  </button>
                </div>

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
              </>
            )}
          </div>
        </div>

        {/* Recently visited sidebar */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="mt-6 section-card p-4 sticky top-[calc(24px+520px)]">
            <h4 className="section-title mb-3">Recently visited</h4>
            <div className="space-y-3">
              {(data?.recent || []).slice(0, 5).map((m) => (
                <a key={m._id} href={`/poll/${m._id}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden" />
                  <div className="text-sm text-gray-700 dark:text-gray-300 group-hover:underline line-clamp-1">{m.title}</div>
                </a>
              ))}
              {(!data?.recent || data.recent.length === 0) && <div className="text-xs text-gray-500">No recent markets</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
