import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import axios from "../setupAxios";
import { BACKEND_URL } from "../contexts/Bakendurl";
import {
  createMarket,
  tokenMint,
  pollTx,
  resolveMarket,
  addLiquidity,
  withdrawSurplus,
  pause,
  unpause,
  lockfees,
  maxtrade,
  setFees,
  setFeeRecipients,
  setMaxTrade,
  pauseMarket,
  unpauseMarket,
} from "../contexts/stacks/marketClient";
import toast from "react-hot-toast";

const Admin = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Politics",
    subCategory: "All",
    endDate: "",
    options: "Yes,No",
    image: "",
    // category specifics
    cryptoName: "",
    cryptoLogo: "",
    team1Name: "",
    team1Logo: "",
    team1Odds: "",
    team2Name: "",
    team2Logo: "",
    team2Odds: "",
    matchTime: "",
    sportType: "",
    country: "",
    countryFlag: "",
    candidates: "", // name|percentage|image per line
  });

  const { data: stats } = useQuery(
    ["admin-dashboard"],
    async () => (await axios.get(`${BACKEND_URL}/api/admin/dashboard`)).data
  );
  const { data: polls, isLoading } = useQuery(
    ["admin-polls", page],
    async () =>
      (await axios.get(`${BACKEND_URL}/api/admin/polls?page=${page}&limit=10`))
        .data
  );

  // Fetch global market status (paused?)
  const { data: marketStatus, refetch: refetchMarketStatus } = useQuery(
    ["market-status"],
    async () => (await axios.get(`${BACKEND_URL}/api/market/status`)).data
  );

  const createMutation = useMutation(
    async () => {
      // step 1: prepare payload for backend
      const optionsList = form.options
        .split(",")
        .map((t) => ({ text: t.trim() }))
        .filter((o) => o.text);

      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        subCategory: form.subCategory,
        endDate: form.endDate,
        options: optionsList,
        image: form.image,
      };

      if (form.category === "Crypto") {
        payload.cryptoName = form.cryptoName;
        payload.cryptoLogo = form.cryptoLogo;
      }
      if (form.category === "Sports") {
        payload.team1 = {
          name: form.team1Name,
          logo: form.team1Logo,
          odds: Number(form.team1Odds) || undefined,
        };
        payload.team2 = {
          name: form.team2Name,
          logo: form.team2Logo,
          odds: Number(form.team2Odds) || undefined,
        };
        payload.matchTime = form.matchTime;
        payload.sportType = form.sportType;
      }
      if (form.category === "Elections") {
        payload.country = form.country;
        payload.countryFlag = form.countryFlag;
        payload.candidates = form.candidates
          .split("\n")
          .map((line) => {
            const [name, percentage, image] = line
              .split("|")
              .map((x) => (x || "").trim());
            if (!name) return null;
            return { name, percentage: Number(percentage) || 0, image };
          })
          .filter(Boolean);
      }

      // step 2: generate unique marketId using timestamp
      const marketId = Date.now().toString();
      const initialLiquidity = 100;
      
      console.log("🔍 Generated timestamp-based marketId:", { marketId, type: typeof marketId });
      console.log("🔍 About to call createMarket with:", { marketId, initialLiquidity, marketIdType: typeof marketId });
      
      // Validate the marketId (timestamp should be a valid number when parsed)
      const timestampValue = parseInt(marketId);
      if (isNaN(timestampValue) || timestampValue <= 0) {
        throw new Error(`Invalid timestamp-based marketId: ${marketId}`);
      }

      // step 3: call contract to create market (pass as number for contract)
      const tx = await createMarket(timestampValue, initialLiquidity);
      await pollTx(tx.txId);

      // step 4: push to backend (no token mint, include marketId as string)
      return (
        await axios.post(`${BACKEND_URL}/api/polls`, {
          ...payload,
          marketId, // save this as string for blockchain tracking
          txid: tx.txId,
        })
      ).data;
    },
    {
      onSuccess: () => {
        setCreating(false);
        setForm({
          title: "",
          description: "",
          category: "Politics",
          subCategory: "All",
          endDate: "",
          options: "Yes,No",
          image: "",
          cryptoName: "",
          cryptoLogo: "",
          team1Name: "",
          team1Logo: "",
          team1Odds: "",
          team2Name: "",
          team2Logo: "",
          team2Odds: "",
          matchTime: "",
          sportType: "",
          country: "",
          countryFlag: "",
          candidates: "",
        });
        queryClient.invalidateQueries(["admin-polls"]);
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) =>
      (await axios.delete(`${BACKEND_URL}/api/admin/polls/${id}`)).data,
    {
      onSuccess: () => queryClient.invalidateQueries(["admin-polls"]),
    }
  );

  const [editingPoll, setEditingPoll] = useState(null);
  const [resolvingPoll, setResolvingPoll] = useState(null);
  const [resolveIndex, setResolveIndex] = useState("");
  const [liquidityModalPoll, setLiquidityModalPoll] = useState(null);
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [maxTradeModalOpen, setMaxTradeModalOpen] = useState(false);
  const [maxTradeAmount, setMaxTradeAmount] = useState("");
  
  // Market management modals
  const [setFeesModalOpen, setSetFeesModalOpen] = useState(false);
  const [setFeeRecipientsModalOpen, setSetFeeRecipientsModalOpen] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [feesData, setFeesData] = useState({ protocolBps: "", lpBps: "" });
  const [feeRecipientsData, setFeeRecipientsData] = useState({ 
    drip: "", brc20: "", team: "", lp: "" 
  });

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedMarketId !== null) {
        setSelectedMarketId(null);
      }
    };

    if (selectedMarketId !== null) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [selectedMarketId]);
  const updateMutation = useMutation(
    async ({ id, data }) =>
      (await axios.put(`${BACKEND_URL}/api/admin/polls/${id}`, data)).data,
    {
      onSuccess: () => {
        setEditingPoll(null);
        queryClient.invalidateQueries(["admin-polls"]);
      },
    }
  );
  const resolveMutation = useMutation(
    async ({ id, winningOption }) => {
      // 1. Get poll from list (has marketId and options)
      const poll = (polls?.polls || []).find((p) => p._id === id);
      if (!poll) throw new Error("Poll not found");
      if (!poll.marketId) throw new Error("Poll missing marketId");
      const marketId = Number(poll.marketId);
      if (!Number.isFinite(marketId)) throw new Error("Invalid marketId");
      const option = poll.options?.[winningOption];
      if (!option) throw new Error("Invalid winning option");
      // 2. Map option text to YES/NO (contract expects "YES" or "NO")
      let result = (option.text || "").toString().toUpperCase().trim();
      if (result !== "YES" && result !== "NO") {
        // fallback: if not exactly YES/NO, try to map
        if (winningOption === 0) result = "YES";
        else if (winningOption === 1) result = "NO";
        else throw new Error("Option text must be YES or NO");
      }
      // 3. Call contract to resolve market
      const tx = await resolveMarket(marketId, result);
      console.log("⏳ Waiting for on-chain resolve confirmation", tx);
      await pollTx(tx.txId);
      // 4. Only after on-chain success, POST to backend
      return (
        await axios.post(`${BACKEND_URL}/api/admin/polls/${id}/resolve`, {
          winningOption,
          txid: tx.txId,
        })
      ).data;
    },
    {
      onSuccess: () => {
        setResolvingPoll(null);
        queryClient.invalidateQueries(["admin-polls"]);
      },
    }
  );

  const addLiquidityMutation = useMutation(
    async ({ id, amount }) => {
      const poll = (polls?.polls || []).find((p) => p._id === id);
      if (!poll) throw new Error("Poll not found");
      if (!poll.marketId) throw new Error("Poll missing marketId");
      const marketId = Number(poll.marketId);
      if (!Number.isFinite(marketId)) throw new Error("Invalid marketId");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Invalid amount");

      const tx = await addLiquidity(marketId, amt);
      await pollTx(tx.txId);
      return tx;
    },
    {
      onSuccess: () => {
        setLiquidityModalPoll(null);
        setLiquidityAmount("");
        queryClient.invalidateQueries(["admin-polls"]);
        toast.success("✅ Liquidity added successfully");
      },
      onError: (err) => {
        toast.error(`❌ Add liquidity failed: ${err?.message || err}`);
      },
    }
  );

  // Admin market management mutations
  const pauseMutation = useMutation(async () => {
    const tx = await pause();
    await pollTx(tx.txId);
    return tx;
  }, {
    onSuccess: () => {
      toast.success('✅ Market paused successfully');
      queryClient.invalidateQueries(['admin-polls']);
    },
    onError: (err) => {
      toast.error(`❌ Pause failed: ${err?.message || err}`);
    }
  });

  const unpauseMutation = useMutation(async () => {
    const tx = await unpause();
    await pollTx(tx.txId);
    return tx;
  }, {
    onSuccess: () => {
      toast.success('✅ Market unpaused successfully');
      queryClient.invalidateQueries(['admin-polls']);
    },
    onError: (err) => {
      toast.error(`❌ Unpause failed: ${err?.message || err}`);
    }
  });

  const lockFeesMutation = useMutation(async () => {
    const tx = await lockfees();
    await pollTx(tx.txId);
    return tx;
  }, {
    onSuccess: () => {
      toast.success('✅ Fees locked successfully');
      queryClient.invalidateQueries(['admin-polls']);
    },
    onError: (err) => {
      toast.error(`❌ Lock fees failed: ${err?.message || err}`);
    }
  });

  const withdrawSurplusMutation = useMutation(
    async ({ id }) => {
      const poll = (polls?.polls || []).find((p) => p._id === id);
      if (!poll) throw new Error("Poll not found");
      if (!poll.marketId) throw new Error("Poll missing marketId");
      const marketId = Number(poll.marketId);
      if (!Number.isFinite(marketId)) throw new Error("Invalid marketId");

      const tx = await withdrawSurplus(marketId);
      await pollTx(tx.txId);
      // After on-chain success, mark on backend as withdrawn
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/polls/${id}/withdraw-surplus`,
        {
          txid: tx.txId,
        }
      );
      return { tx, backend: res.data };
    },
    {
      onSuccess: (data, variables) => {
        const { id } = variables || {};
        const backendPoll = data?.backend?.poll;

        console.log("Withdraw surplus backend response:", data?.backend);

        try {
          // Update all cached admin-polls queries (all pages)
          const queries = queryClient.getQueryCache().findAll();
          queries.forEach((q) => {
            const key = q.queryKey;
            if (!key || key[0] !== "admin-polls") return;
            queryClient.setQueryData(key, (old) => {
              if (!old) return old;
              const updated = { ...old };
              updated.polls = (updated.polls || []).map((p) => {
                if (p._id !== id) return p;
                // Prefer backendPoll if available
                if (backendPoll) return backendPoll;
                return {
                  ...p,
                  surplusWithdrawn: true,
                  surplusWithdrawTx: data?.tx?.txId || p.surplusWithdrawTx,
                };
              });
              return updated;
            });
          });

          // Debug: log the updated poll from cache
          const cached = queryClient.getQueryData(["admin-polls", page]);
          console.log("Updated admin-polls cache (page):", cached);
        } catch (e) {
          console.warn("Cache update failed:", e);
        }

        queryClient.invalidateQueries(["admin-polls"]);
        toast.success("✅ Surplus withdrawn successfully");
      },
      onError: (err) => {
        toast.error(`❌ Withdraw surplus failed: ${err?.message || err}`);
      },
    }
  );

  // Market-specific mutations
  const pauseMarketMutation = useMutation(
    async ({ marketId }) => {
      const tx = await pauseMarket(marketId);
      await pollTx(tx.txId);
      await axios.post(`${BACKEND_URL}/api/admin/market/${marketId}/pause`, {
        txid: tx.txId,
      });
      toast.success('✅ Market paused');
      queryClient.invalidateQueries(["admin-polls"]);
    },
    {
      onError: (err) => toast.error(`❌ Pause market failed: ${err?.message || err}`),
    }
  );

  const unpauseMarketMutation = useMutation(
    async ({ marketId }) => {
      const tx = await unpauseMarket(marketId);
      await pollTx(tx.txId);
      await axios.post(`${BACKEND_URL}/api/admin/market/${marketId}/unpause`, {
        txid: tx.txId,
      });
      toast.success('✅ Market unpaused');
      queryClient.invalidateQueries(["admin-polls"]);
    },
    {
      onError: (err) => toast.error(`❌ Unpause market failed: ${err?.message || err}`),
    }
  );

  const setFeesMutation = useMutation(
    async ({ protocolBps, lpBps }) => {
      const tx = await setFees(Number(protocolBps), Number(lpBps));
      await pollTx(tx.txId);
      toast.success('✅ Global fees set');
      queryClient.invalidateQueries(["admin-polls"]);
    },
    {
      onError: (err) => toast.error(`❌ Set fees failed: ${err?.message || err}`),
    }
  );

  const setFeeRecipientsMutation = useMutation(
    async ({ drip, brc20, team, lp }) => {
      const tx = await setFeeRecipients(drip, brc20, team, lp);
      await pollTx(tx.txId);
      toast.success('✅ Global fee recipients set');
      queryClient.invalidateQueries(["admin-polls"]);
    },
    {
      onError: (err) => toast.error(`❌ Set fee recipients failed: ${err?.message || err}`),
    }
  );

  const setMaxTradeMutation = useMutation(
    async ({ marketId, limit }) => {
      console.log("🔍 setMaxTradeMutation called with:", { marketId, limit, marketIdType: typeof marketId, limitType: typeof limit });
      
      const marketIdNum = Number(marketId);
      const limitNum = Number(limit);
      
      console.log("🔍 Converted values:", { marketIdNum, limitNum });
      
      if (isNaN(marketIdNum) || isNaN(limitNum)) {
        throw new Error(`Invalid marketId or limit: marketId=${marketId}, limit=${limit}`);
      }
      
      const tx = await setMaxTrade(marketIdNum, limitNum);
      await pollTx(tx.txId);
      await axios.post(`${BACKEND_URL}/api/admin/market/${marketIdNum}/set-max-trade`, {
        limit: limitNum,
        txid: tx.txId,
      });
      toast.success('✅ Max trade set');
      queryClient.invalidateQueries(["admin-polls"]);
    },
    {
      onSuccess: () => {
        setMaxTradeModalOpen(false);
        setMaxTradeAmount("");
        setSelectedMarketId(null);
      },
      onError: (err) => toast.error(`❌ Set max trade failed: ${err?.message || err}`),
    }
  );

  const categories = useMemo(
    () => [
      "Politics",
      "Middle East",
      "Crypto",
      "Tech",
      "Culture",
      "World",
      "Economy",
      "Sports",
      "Elections",
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Admin Dashboard
          </h1>
          <button onClick={() => setCreating(true)} className="btn-primary">
            Create Poll
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Users</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {stats?.totalUsers ?? "-"}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Polls</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {stats?.totalPolls ?? "-"}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Active Polls</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {stats?.activePolls ?? "-"}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500">Volume</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              ${(stats?.totalVolume || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Polls table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">End</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="py-6" colSpan="5">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  (polls?.polls || []).map((p) => (
                    <tr
                      key={p._id}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                        {p.title}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                        {p.category}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                        {new Date(p.endDate).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{p.isActive ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4 flex gap-2 items-center">
                        <button
                          onClick={() => setEditingPoll(p)}
                          className="btn-outline btn-sm"
                        >
                          Edit
                        </button>

                        {/* Add liquidity (if not resolved) or Withdraw surplus (if resolved) */}
                        {!p.isResolved ? (
                          <button
                            onClick={() => setLiquidityModalPoll(p)}
                            className="btn-secondary btn-sm"
                          >
                            Add Liquidity
                          </button>
                        ) : (
                          <button
                            onClick={() => withdrawSurplusMutation.mutate({ id: p._id })}
                            className={`btn-secondary btn-sm ${
                              !!p.surplusWithdrawn || withdrawSurplusMutation.isLoading
                                ? "opacity-50 cursor-not-allowed bg-gray-400 dark:bg-gray-700"
                                : ""
                            }`}
                            disabled={!!p.surplusWithdrawn || withdrawSurplusMutation.isLoading}
                          >
                            {p.surplusWithdrawn ? "Surplus Withdrawn" : "Withdraw Surplus"}
                          </button>
                        )}

                        {/* Resolve button: disabled if already resolved */}
                        <button
                          onClick={() => {
                            if (p.isResolved) {
                              toast("❗ Poll has already been resolved", { icon: "⚠️" });
                              return;
                            }
                            setResolvingPoll(p);
                            setResolveIndex("");
                          }}
                          className={`btn-primary btn-sm ${p.isResolved ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={p.isResolved}
                        >
                          Resolve
                        </button>

                        {/* 3-dot menu for market management */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMarketId(p.marketId ? Number(p.marketId) : null);
                            }}
                            className="btn-outline btn-sm p-2"
                            disabled={!p.marketId}
                          >
                            ⋯
                          </button>
                          {selectedMarketId === Number(p.marketId) && (
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 min-w-48">
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (p.isPaused) {
                                      unpauseMarketMutation.mutate({ marketId: Number(p.marketId) });
                                    } else {
                                      pauseMarketMutation.mutate({ marketId: Number(p.marketId) });
                                    }
                                    setSelectedMarketId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {p.isPaused ? "Unpause Market" : "Pause Market"}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFeesData({ protocolBps: "", lpBps: "" });
                                    setSetFeesModalOpen(true);
                                    setSelectedMarketId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Set Global Fees
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFeeRecipientsData({ drip: "", brc20: "", team: "", lp: "" });
                                    setSetFeeRecipientsModalOpen(true);
                                    setSelectedMarketId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Set Global Fee Recipients
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const marketId = Number(p.marketId);
                                    console.log("🔍 Opening Set Max Trade modal for marketId:", marketId);
                                    setMaxTradeAmount("");
                                    setMaxTradeModalOpen(true);
                                    setSelectedMarketId(marketId);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Set Max Trade
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => deleteMutation.mutate(p._id)}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button
              className="btn-outline btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!polls?.pagination?.hasPrev}
            >
              Prev
            </button>
            <button
              className="btn-outline btn-sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!polls?.pagination?.hasNext}
            >
              Next
            </button>
          </div>
        </div>

        {/* Lock Fees Button - Global, One-time */}
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                ⚠️ Lock Fees Configuration
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                This action is GLOBAL and ONE-TIME ONLY. Once locked, fees cannot be changed for any market.
                Use with extreme caution!
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('⚠️ WARNING: This will lock fees globally and permanently. Are you absolutely sure?')) {
                  lockFeesMutation.mutate();
                }
              }}
              className={`btn-danger ${lockFeesMutation.isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={lockFeesMutation.isLoading}
            >
              {lockFeesMutation.isLoading ? 'Locking...' : '🔒 Lock Fees Globally'}
            </button>
          </div>
        </div>


        {/* Create modal */}
        {creating && (
          <div className="modal-overlay" onClick={() => setCreating(false)}>
            <div
              className="modal-content max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Create Poll
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Title
                    </label>
                    <input
                      className="input w-full"
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      className="input w-full h-24"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      className="input w-full"
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Sub-category
                    </label>
                    <input
                      className="input w-full"
                      value={form.subCategory}
                      onChange={(e) =>
                        setForm({ ...form, subCategory: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="datetime-local"
                      className="input w-full"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm({ ...form, endDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Options (comma separated)
                    </label>
                    <input
                      className="input w-full"
                      value={form.options}
                      onChange={(e) =>
                        setForm({ ...form, options: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Image URL
                    </label>
                    <input
                      className="input w-full"
                      value={form.image}
                      onChange={(e) =>
                        setForm({ ...form, image: e.target.value })
                      }
                    />
                  </div>

                  {/* Crypto specifics */}
                  {form.category === "Crypto" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Crypto Name
                        </label>
                        <input
                          className="input w-full"
                          value={form.cryptoName}
                          onChange={(e) =>
                            setForm({ ...form, cryptoName: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Crypto Logo URL
                        </label>
                        <input
                          className="input w-full"
                          value={form.cryptoLogo}
                          onChange={(e) =>
                            setForm({ ...form, cryptoLogo: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Sports specifics */}
                  {form.category === "Sports" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 1 Name
                        </label>
                        <input
                          className="input w-full"
                          value={form.team1Name}
                          onChange={(e) =>
                            setForm({ ...form, team1Name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 1 Logo
                        </label>
                        <input
                          className="input w-full"
                          value={form.team1Logo}
                          onChange={(e) =>
                            setForm({ ...form, team1Logo: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 1 Odds
                        </label>
                        <input
                          className="input w-full"
                          value={form.team1Odds}
                          onChange={(e) =>
                            setForm({ ...form, team1Odds: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 2 Name
                        </label>
                        <input
                          className="input w-full"
                          value={form.team2Name}
                          onChange={(e) =>
                            setForm({ ...form, team2Name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 2 Logo
                        </label>
                        <input
                          className="input w-full"
                          value={form.team2Logo}
                          onChange={(e) =>
                            setForm({ ...form, team2Logo: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 2 Odds
                        </label>
                        <input
                          className="input w-full"
                          value={form.team2Odds}
                          onChange={(e) =>
                            setForm({ ...form, team2Odds: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Match Time
                        </label>
                        <input
                          type="datetime-local"
                          className="input w-full"
                          value={form.matchTime}
                          onChange={(e) =>
                            setForm({ ...form, matchTime: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Sport Type
                        </label>
                        <input
                          className="input w-full"
                          value={form.sportType}
                          onChange={(e) =>
                            setForm({ ...form, sportType: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Elections specifics */}
                  {form.category === "Elections" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Country
                        </label>
                        <input
                          className="input w-full"
                          value={form.country}
                          onChange={(e) =>
                            setForm({ ...form, country: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Country Flag URL
                        </label>
                        <input
                          className="input w-full"
                          value={form.countryFlag}
                          onChange={(e) =>
                            setForm({ ...form, countryFlag: e.target.value })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Candidates (one per line: name|percentage|image)
                        </label>
                        <textarea
                          className="input w-full h-24"
                          value={form.candidates}
                          onChange={(e) =>
                            setForm({ ...form, candidates: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    className="btn-outline"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isLoading}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editingPoll && (
          <div className="modal-overlay" onClick={() => setEditingPoll(null)}>
            <div
              className="modal-content max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Edit Poll
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Title
                    </label>
                    <input
                      className="input w-full"
                      value={editingPoll.title || ""}
                      onChange={(e) =>
                        setEditingPoll({
                          ...editingPoll,
                          title: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      className="input w-full h-24"
                      value={editingPoll.description || ""}
                      onChange={(e) =>
                        setEditingPoll({
                          ...editingPoll,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Featured
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!editingPoll.featured}
                        onChange={(e) =>
                          setEditingPoll({
                            ...editingPoll,
                            featured: e.target.checked,
                          })
                        }
                      />{" "}
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Mark as featured
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Trending
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!editingPoll.trending}
                        onChange={(e) =>
                          setEditingPoll({
                            ...editingPoll,
                            trending: e.target.checked,
                          })
                        }
                      />{" "}
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Mark as trending
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Sub-category
                    </label>
                    <input
                      className="input w-full"
                      value={editingPoll.subCategory || ""}
                      onChange={(e) =>
                        setEditingPoll({
                          ...editingPoll,
                          subCategory: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="datetime-local"
                      className="input w-full"
                      value={
                        editingPoll.endDate
                          ? new Date(editingPoll.endDate)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setEditingPoll({
                          ...editingPoll,
                          endDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Image URL
                    </label>
                    <input
                      className="input w-full"
                      value={editingPoll.image || ""}
                      onChange={(e) =>
                        setEditingPoll({
                          ...editingPoll,
                          image: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Crypto */}
                  {editingPoll.category === "Crypto" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Crypto Name
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.cryptoName || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              cryptoName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Crypto Logo
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.cryptoLogo || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              cryptoLogo: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Sports */}
                  {editingPoll.category === "Sports" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 1 Name
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.team1?.name || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              team1: {
                                ...(editingPoll.team1 || {}),
                                name: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 1 Logo
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.team1?.logo || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              team1: {
                                ...(editingPoll.team1 || {}),
                                logo: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 1 Odds
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.team1?.odds ?? ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              team1: {
                                ...(editingPoll.team1 || {}),
                                odds: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 2 Name
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.team2?.name || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              team2: {
                                ...(editingPoll.team2 || {}),
                                name: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 2 Logo
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.team2?.logo || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              team2: {
                                ...(editingPoll.team2 || {}),
                                logo: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Team 2 Odds
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.team2?.odds ?? ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              team2: {
                                ...(editingPoll.team2 || {}),
                                odds: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Match Time
                        </label>
                        <input
                          type="datetime-local"
                          className="input w-full"
                          value={
                            editingPoll.matchTime
                              ? new Date(editingPoll.matchTime)
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              matchTime: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Sport Type
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.sportType || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              sportType: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Elections */}
                  {editingPoll.category === "Elections" && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Country
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.country || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              country: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Country Flag
                        </label>
                        <input
                          className="input w-full"
                          value={editingPoll.countryFlag || ""}
                          onChange={(e) =>
                            setEditingPoll({
                              ...editingPoll,
                              countryFlag: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
                {/* Options editor */}
                <div className="md:col-span-2 mt-2">
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-2">
                    Options
                  </label>
                  <div className="space-y-2">
                    {(editingPoll.options || []).map((opt, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-7 gap-2 items-center"
                      >
                        <input
                          className="input col-span-3"
                          value={opt.text}
                          onChange={(e) => {
                            const updated = [...editingPoll.options];
                            updated[idx] = {
                              ...updated[idx],
                              text: e.target.value,
                            };
                            setEditingPoll({
                              ...editingPoll,
                              options: updated,
                            });
                          }}
                        />
                        <input
                          className="input col-span-2"
                          type="number"
                          min="0"
                          max="100"
                          value={opt.percentage ?? 0}
                          onChange={(e) => {
                            const updated = [...editingPoll.options];
                            updated[idx] = {
                              ...updated[idx],
                              percentage: Number(e.target.value),
                            };
                            setEditingPoll({
                              ...editingPoll,
                              options: updated,
                            });
                          }}
                        />
                        <input
                          className="input col-span-2"
                          placeholder="Image URL (optional)"
                          value={opt.image || ""}
                          onChange={(e) => {
                            const updated = [...editingPoll.options];
                            updated[idx] = {
                              ...updated[idx],
                              image: e.target.value,
                            };
                            setEditingPoll({
                              ...editingPoll,
                              options: updated,
                            });
                          }}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        className="btn-outline btn-sm"
                        onClick={() =>
                          setEditingPoll({
                            ...editingPoll,
                            options: [
                              ...(editingPoll.options || []),
                              { text: "New Option", percentage: 0 },
                            ],
                          })
                        }
                      >
                        Add Option
                      </button>
                      <button
                        className="btn-outline btn-sm"
                        onClick={() =>
                          setEditingPoll({
                            ...editingPoll,
                            options: (editingPoll.options || []).slice(0, -1),
                          })
                        }
                        disabled={
                          !editingPoll.options ||
                          editingPoll.options.length <= 2
                        }
                      >
                        Remove Last
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 md:col-span-2">
                  <button
                    className="btn-outline"
                    onClick={() => setEditingPoll(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      updateMutation.mutate({
                        id: editingPoll._id,
                        data: editingPoll,
                      })
                    }
                    disabled={updateMutation.isLoading}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resolve modal */}
        {resolvingPoll && (
          <div className="modal-overlay" onClick={() => setResolvingPoll(null)}>
            <div
              className="modal-content max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Resolve Poll
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Select the winning option:
                </p>
                <select
                  className="input w-full"
                  value={resolveIndex}
                  onChange={(e) => setResolveIndex(e.target.value)}
                >
                  <option value="" disabled>
                    -- Select option --
                  </option>
                  {resolvingPoll.options?.map((opt, idx) => (
                    <option key={idx} value={idx}>
                      {opt.text || `Option ${idx}`}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    className="btn-outline"
                    onClick={() => setResolvingPoll(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      resolveMutation.mutate({
                        id: resolvingPoll._id,
                        winningOption: Number(resolveIndex),
                      })
                    }
                    disabled={resolveMutation.isLoading || resolveIndex === ""}
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Liquidity modal */}
        {liquidityModalPoll && (
          <div className="modal-overlay" onClick={() => setLiquidityModalPoll(null)}>
            <div
              className="modal-content max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Add Liquidity
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Market ID: {liquidityModalPoll.marketId || "(none)"}
                </p>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <input
                  className="input w-full"
                  value={liquidityAmount}
                  onChange={(e) => setLiquidityAmount(e.target.value)}
                  placeholder="Enter amount (sats)"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setLiquidityModalPoll(null);
                      setLiquidityAmount("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      addLiquidityMutation.mutate({
                        id: liquidityModalPoll._id,
                        amount: liquidityAmount,
                      })
                    }
                    disabled={addLiquidityMutation.isLoading || !liquidityAmount}
                  >
                    Add Liquidity
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Set Max Trade modal */}
        {maxTradeModalOpen && (
          <div className="modal-overlay" onClick={() => setMaxTradeModalOpen(false)}>
            <div
              className="modal-content max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Set Max Trade
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Market ID: {selectedMarketId || 'Not selected'}
                </p>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <input
                  className="input w-full"
                  value={maxTradeAmount}
                  onChange={(e) => setMaxTradeAmount(e.target.value)}
                  placeholder="Enter max trade amount (sats)"
                />
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setMaxTradeModalOpen(false);
                      setMaxTradeAmount('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (selectedMarketId) {
                        console.log("🔍 Calling setMaxTradeMutation with:", { marketId: selectedMarketId, limit: maxTradeAmount });
                        setMaxTradeMutation.mutate({ marketId: selectedMarketId, limit: maxTradeAmount });
                      }
                    }}
                    disabled={setMaxTradeMutation.isLoading || !maxTradeAmount || !selectedMarketId}
                  >
                    {setMaxTradeMutation.isLoading ? 'Setting...' : 'Set Max Trade'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Set Fees modal */}
        {setFeesModalOpen && (
          <div className="modal-overlay" onClick={() => setSetFeesModalOpen(false)}>
            <div
              className="modal-content max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Set Global Fees
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This will set fees for ALL markets globally. Use with caution!
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Protocol BPS
                    </label>
                    <input
                      className="input w-full"
                      value={feesData.protocolBps}
                      onChange={(e) => setFeesData({ ...feesData, protocolBps: e.target.value })}
                      placeholder="Enter protocol BPS (basis points)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      LP BPS
                    </label>
                    <input
                      className="input w-full"
                      value={feesData.lpBps}
                      onChange={(e) => setFeesData({ ...feesData, lpBps: e.target.value })}
                      placeholder="Enter LP BPS (basis points)"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setSetFeesModalOpen(false);
                      setFeesData({ protocolBps: "", lpBps: "" });
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setFeesMutation.mutate({ 
                        protocolBps: feesData.protocolBps, 
                        lpBps: feesData.lpBps 
                      });
                      setSetFeesModalOpen(false);
                      setFeesData({ protocolBps: "", lpBps: "" });
                    }}
                    disabled={setFeesMutation.isLoading || !feesData.protocolBps || !feesData.lpBps}
                  >
                    {setFeesMutation.isLoading ? 'Setting...' : 'Set Global Fees'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Set Fee Recipients modal */}
        {setFeeRecipientsModalOpen && (
          <div className="modal-overlay" onClick={() => setSetFeeRecipientsModalOpen(false)}>
            <div
              className="modal-content max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Set Global Fee Recipients
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This will set fee recipients for ALL markets globally. Use with caution!
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Drip Address
                    </label>
                    <input
                      className="input w-full"
                      value={feeRecipientsData.drip}
                      onChange={(e) => setFeeRecipientsData({ ...feeRecipientsData, drip: e.target.value })}
                      placeholder="Enter drip address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      BRC20 Address
                    </label>
                    <input
                      className="input w-full"
                      value={feeRecipientsData.brc20}
                      onChange={(e) => setFeeRecipientsData({ ...feeRecipientsData, brc20: e.target.value })}
                      placeholder="Enter BRC20 address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Team Address
                    </label>
                    <input
                      className="input w-full"
                      value={feeRecipientsData.team}
                      onChange={(e) => setFeeRecipientsData({ ...feeRecipientsData, team: e.target.value })}
                      placeholder="Enter team address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      LP Address
                    </label>
                    <input
                      className="input w-full"
                      value={feeRecipientsData.lp}
                      onChange={(e) => setFeeRecipientsData({ ...feeRecipientsData, lp: e.target.value })}
                      placeholder="Enter LP address"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setSetFeeRecipientsModalOpen(false);
                      setFeeRecipientsData({ drip: "", brc20: "", team: "", lp: "" });
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setFeeRecipientsMutation.mutate({ 
                        drip: feeRecipientsData.drip, 
                        brc20: feeRecipientsData.brc20, 
                        team: feeRecipientsData.team, 
                        lp: feeRecipientsData.lp 
                      });
                      setSetFeeRecipientsModalOpen(false);
                      setFeeRecipientsData({ drip: "", brc20: "", team: "", lp: "" });
                    }}
                    disabled={setFeeRecipientsMutation.isLoading || !feeRecipientsData.drip || !feeRecipientsData.brc20 || !feeRecipientsData.team || !feeRecipientsData.lp}
                  >
                    {setFeeRecipientsMutation.isLoading ? 'Setting...' : 'Set Global Fee Recipients'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
