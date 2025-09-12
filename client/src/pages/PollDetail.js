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
  getQuoteYes,
  getQuoteNo,
  getRewardClaimed,
  buyYes,
  buyNo,
  sellYes,
  sellNo,
  buyYesAuto,
  buyNoAuto,
  sellYesAuto,
  sellNoAuto,
  redeem,
  pollTx,
} from "../contexts/stacks/marketClient";

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

  // order type
  const [orderType, setOrderType] = useState("market"); // 'market' | 'limit'

  const poll = data?.poll;
  const [liveOrderBook, setLiveOrderBook] = useState(data?.orderBook || null);
  const [liveTrades, setLiveTrades] = useState(data?.tradeHistory || []);
  const [claimed, setClaimed] = useState(false);

  // dynamic contract data
  const [contractData, setContractData] = useState({
    outcome: "",
    optionPool: { yes: 0, no: 0 },
    optionBalance: { yes: 0, no: 0 },
    pool: 0,
    rewardClaimed: false,
    yesSupply: 0,
    noSupply: 0,
  });
  const [contractLoading, setContractLoading] = useState(false);
  // logging guard
  const _logged = useRef({ contract: false, backend: false });

  // compute market price from on-chain pools (0-1)
  const marketPrice = useMemo(() => {
    if (!contractData || !contractData.pool) return 0.5;
    // map selected option to yes/no pools for binary markets
    const idx = selectedOptionIndex === 0 ? "yes" : "no";
    const optPool = contractData.optionPool?.[idx] ?? 0;
    const price = contractData.pool ? optPool / contractData.pool : 0.5;
    return Number(price.toFixed(2));
  }, [contractData, selectedOptionIndex]);

  // tiny no-op to reference setters so lint doesn't complain while feature is present
  useEffect(() => {
    void setLiveOrderBook;
  }, []);

  // human-readable time remaining
  const timeRemaining = useMemo(() => {
    if (!poll) return "";
    if (poll.isResolved) return "Resolved";
    const end = new Date(poll.endDate);
    const now = new Date();
    const diff = end - now;
    if (diff <= 0) return "Ended";
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  }, [poll]);

  // redeem mutation for claiming rewards on resolved polls
  const redeemMutation = useMutation(
    async () => {
      if (!poll) throw new Error("No poll");
      if (!poll.marketId) throw new Error("Missing marketId for redeem");
      const marketId = Number(poll.marketId);

      // call on-chain redeem via wallet
      let txRes = null;
      try {
        txRes = await redeem(marketId);
      } catch (err) {
        console.error("On-chain redeem failed or cancelled", err);
        throw err;
      }

      const txId = txRes?.txId || txRes?.tx_id || txRes?.txid || null;
      if (!txId) throw new Error("No txId returned from wallet for redeem");

      // wait for on-chain confirmation
      try {
        await pollTx(txId, 5000, 60);
      } catch (err) {
        console.error("Redeem transaction failed to confirm", err);
        throw err;
      }

      // notify backend to mark rewardClaimed true
      const res = await axios.post(
        `${BACKEND_URL}/api/polls/${poll._id}/redeem`,
        {
          txid: txId,
        }
      );
      return res.data;
    },
    {
      onSuccess: (res) => {
        setClaimed(true);
        queryClient.invalidateQueries(["poll-detail", id]);
        toast.success(res?.message || "Reward claimed");
      },
      onError: (err) => {
        toast.error(
          err?.response?.data?.message || err.message || "Redeem failed"
        );
      },
    }
  );

  // debug logs: show contract data and backend poll response only once
  // logging guard (kept for potential debug use) - currently unused

  useEffect(() => {
    // log backend data once when it first arrives
    if (data && !_logged.current.backend) {
      console.log("backend data:", data);
      _logged.current.backend = true;
    }
    // log contract data once when pool or outcome becomes available
    if (
      contractData &&
      !_logged.current.contract &&
      (contractData.pool ||
        contractData.outcome ||
        contractData.yesSupply ||
        contractData.noSupply)
    ) {
      console.log("contractData:", contractData);
      _logged.current.contract = true;
    }
  }, [data, contractData]);

  // fetch contract read-only data
  useEffect(() => {
    let mounted = true;
    async function fetchContract() {
      if (!poll || !poll.marketId) return;
      const marketId = Number(poll.marketId);
      if (!Number.isFinite(marketId) || Number.isNaN(marketId)) {
        console.warn(
          "Invalid marketId, skipping contract reads:",
          poll.marketId
        );
        return;
      }
      setContractLoading(true);
      try {
        const [poolRes, outcomeRes, yesSupplyRes, noSupplyRes] =
          await Promise.all([
            getPool(marketId),
            getOutcome(marketId),
            getYesSupply(marketId),
            getNoSupply(marketId),
          ]);

        // get per-user balances if user has a principal/wallet address
        let yesBal = 0;
        let noBal = 0;
        let rewardClaimed = false;
        const principal = user?.walletAddress || user?.address || null;
        if (principal) {
          try {
            yesBal = await getYesBalance(marketId, principal);
            noBal = await getNoBalance(marketId, principal);
            rewardClaimed = await getRewardClaimed(marketId, principal);
          } catch (e) {
            // log debug info but don't fail the whole fetch
            console.warn("Per-user contract read failed", {
              marketId,
              principal,
              err: e?.message || e,
            });
          }
        }

        // map results (contract read helpers return CV-like objects; handle numbers or objects)
        const mapNumeric = (r) => {
          if (r === undefined || r === null) return 0;
          if (typeof r === "number") return r;
          if (r.value && typeof r.value === "number") return r.value;
          if (r.value && r.value.toString) return Number(r.value.toString());
          return Number(r.toString?.() || 0);
        };

        const pool = mapNumeric(poolRes);
        const yesSupply = mapNumeric(yesSupplyRes);
        const noSupply = mapNumeric(noSupplyRes);
        const outcome = (outcomeRes && outcomeRes.value) || outcomeRes || "";

        if (mounted) {
          setContractData({
            outcome,
            optionPool: {
              yes: pool * (yesSupply / (yesSupply + noSupply || 1)),
              no: pool * (noSupply / (yesSupply + noSupply || 1)),
            },
            optionBalance: { yes: mapNumeric(yesBal), no: mapNumeric(noBal) },
            pool,
            rewardClaimed: !!rewardClaimed,
            yesSupply,
            noSupply,
          });
        }
      } catch (err) {
        console.warn("Failed to read contract data", err);
      } finally {
        if (mounted) setContractLoading(false);
      }
    }
    fetchContract();
    const interval = setInterval(fetchContract, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [poll, user]);

  // keep liveTrades in sync when server data changes
  useEffect(() => {
    setLiveTrades(data?.tradeHistory || []);
  }, [data?.tradeHistory]);

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
    const outcomeStr = (contractData?.outcome || "").toString().toLowerCase();
    const contractIdx = poll?.options?.findIndex((o) =>
      o.text?.toLowerCase().includes(outcomeStr)
    );
    const winningIdx =
      typeof poll?.winningOption === "number"
        ? poll.winningOption
        : contractIdx;
    if (typeof winningIdx !== "number" || winningIdx < 0) return false;
    return userTrades.some((t) => t.optionIndex === winningIdx);
  }, [userTrades, poll, contractData]);

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

  // trade mutation now supports on-chain market execution for 'market' orderType
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

      // --- Step 0: detect if this is YES/NO
      const selectedOptionText = (
        poll?.options?.[selectedOptionIndex]?.text || ""
      )
        .toString()
        .toLowerCase()
        .trim();

      const isYes =
        selectedOptionText.includes("yes") || selectedOptionIndex === 0;

      if (!poll?.marketId) {
        toast.error("Missing marketId for on-chain execution");
        return Promise.reject(new Error("Missing marketId"));
      }
      const marketId = Number(poll.marketId);

      // --- Step 1: get quote value first ---
      let q = null;
      try {
        q = isYes
          ? await getQuoteYes(marketId, Number(amount))
          : await getQuoteNo(marketId, Number(amount));

        console.log("Raw quote response:", q);

        // Decode clarity data
        const quoteData = q?.value?.data || null;
        if (quoteData) {
          const decoded = {
            cost: Number(quoteData.cost?.value || 0),
            feeProtocol: Number(quoteData.feeProtocol?.value || 0),
            feeLP: Number(quoteData.feeLP?.value || 0),
            total: Number(quoteData.total?.value || 0),
            drip: Number(quoteData.drip?.value || 0),
            brc20: Number(quoteData.brc20?.value || 0),
            team: Number(quoteData.team?.value || 0),
          };

          console.log(
            `📊 Quote breakdown for ${isYes ? "YES" : "NO"}:`,
            decoded
          );
        }
      } catch (err) {
        console.error("❌ Failed to fetch quote:", err);
      }

      // --- Step 2: execute order ---
      let txResult = null;
      try {
        if (orderType === "market") {
          if (side === "buy") {
            txResult = isYes
              ? await buyYes(marketId, Number(amount))
              : await buyNo(marketId, Number(amount));
          } else {
            txResult = isYes
              ? await sellYes(marketId, Number(amount))
              : await sellNo(marketId, Number(amount));
          }
        } else {
          const amt = Math.ceil(Number(amount) || 0);

          // ✅ Properly handle BigInt values from quote
          const quoteTuple = q?.value?.value; // tuple layer
          const totalBigInt = quoteTuple?.total?.value ?? 0n;

          console.log("🔹 Raw total from quote (BigInt):", totalBigInt);

          // Do BigInt math
          const targetCapBigInt = totalBigInt * 10n;
          const maxCostBigInt = (totalBigInt * 110n) / 100n;

          // Convert to Number
          const total = Number(totalBigInt);
          const targetCap = Number(targetCapBigInt);
          const maxCost = Number(maxCostBigInt);

          console.log("📊 Calculated values:", { total, targetCap, maxCost });

          if (side === "buy") {
            txResult = isYes
              ? await buyYesAuto(marketId, amt, targetCap, maxCost)
              : await buyNoAuto(marketId, amt, targetCap, maxCost);
          } else {
            txResult = isYes
              ? await sellYesAuto(marketId, amt, targetCap, maxCost)
              : await sellNoAuto(marketId, amt, targetCap, maxCost);
          }
        }
      } catch (err) {
        console.error("❌ On-chain call failed/was cancelled", err);
        throw err;
      }

      // --- Step 3: confirm tx ---
      const txId = txResult?.txId || txResult?.tx_id || txResult?.txid || null;
      if (!txId) throw new Error("No txId returned from wallet");

      try {
        const confirmed = await pollTx(txId, 5000, 60);
        console.log("✅ Transaction confirmed on-chain:", confirmed);
        payload.txId = txId;
      } catch (err) {
        console.error("❌ Transaction failed to confirm:", err);
        throw err;
      }

      // --- Step 4: post trade to backend ---
      const res = await axios.post(`${BACKEND_URL}/api/trades`, payload);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["poll-detail", id]);
        queryClient.invalidateQueries(["trades", id]);
        setAmount("");
        toast.success("Trade placed");
      },
      onError: (err) => {
        toast.error(
          err?.response?.data?.message || err.message || "Trade failed"
        );
      },
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
                <span>Market Progress</span>
                {contractLoading && (
                  <span className="ml-2 text-xs text-gray-500">
                    Reading on-chain...
                  </span>
                )}
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
                  <div className="flex items-center gap-3">
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

                  {/* Order type toggle */}
                  <div className="ml-3 inline-flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setOrderType("market")}
                      className={`px-2 py-1 text-xs ${
                        orderType === "market"
                          ? "bg-gray-900 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Market
                    </button>
                    <button
                      onClick={() => setOrderType("limit")}
                      className={`px-2 py-1 text-xs ${
                        orderType === "limit"
                          ? "bg-gray-900 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Limit
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
                      Price
                    </label>
                    {orderType === "market" ? (
                      <input
                        type="text"
                        readOnly
                        value={marketPrice}
                        className="input w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="input w-full"
                      />
                    )}
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

                {/* Order type toggle for large screen panel */}
                <div className="flex justify-end mb-4">
                  <div className="inline-flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setOrderType("market")}
                      className={`px-2 py-1 text-xs ${
                        orderType === "market"
                          ? "bg-gray-900 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Market
                    </button>
                    <button
                      onClick={() => setOrderType("limit")}
                      className={`px-2 py-1 text-xs ${
                        orderType === "limit"
                          ? "bg-gray-900 text-white"
                          : "bg-transparent text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Limit
                    </button>
                  </div>
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
                      Price
                    </label>
                    {orderType === "market" ? (
                      <input
                        type="text"
                        readOnly
                        value={marketPrice}
                        className="input w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="input w-full"
                      />
                    )}
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
