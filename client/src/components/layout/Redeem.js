import React from "react";

export default function Redeem({
  contractData,
  user,
  userTrades,
  poll,
  isEnded,
  didUserWin,
  redeemMutation,
  claimed,
  formatCurrency,
}) {
  return (
    <div className="space-y-6">
      {/* Contract Outcome */}
      <div>
        <h3 className="text-sm text-gray-500">Market Outcome</h3>
        <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1">
          {contractData.outcome}
        </p>
      </div>

      {/* Option Pools */}
      <div>
        <h3 className="text-sm text-gray-500 mb-3">Option Pools</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">
              Yes Pool
            </p>
            <p className="text-lg font-semibold">
              {formatCurrency(contractData.optionPool.yes)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Balance:{" "}
              <span className="text-base font-medium">
                {contractData.optionBalance.yes}
              </span>
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">
              No Pool
            </p>
            <p className="text-lg font-semibold">
              {formatCurrency(contractData.optionPool.no)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Balance:{" "}
              <span className="text-base font-medium">
                {contractData.optionBalance.no}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Total Pool & Reward Claimed */}
      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <h3 className="text-xs text-gray-500">Total Pool</h3>
          <p className="text-lg font-semibold mt-1">
            {formatCurrency(contractData.pool)}
          </p>
        </div>
        <div>
          <h3 className="text-xs text-gray-500">Reward Claimed</h3>
          <p className="text-lg font-semibold mt-1">
            {poll?.rewardClaimed || contractData.rewardClaimed || claimed
              ? "Yes"
              : "No"}
          </p>
        </div>
      </div>

      {/* Your Trades */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Your Trades
        </h3>
        {user && userTrades.length > 0 ? (
          <div className="space-y-3">
            {userTrades.map((t) => (
              <div
                key={t._id}
                className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-md"
              >
                <div>
                  <span
                    className={`${
                      t.type === "buy" ? "text-green-600" : "text-red-500"
                    } font-semibold`}
                  >
                    {t.type.toUpperCase()}
                  </span>
                  <span className="ml-2 text-sm">• {t.amount}</span>
                  <div className="text-xs text-gray-500">
                    {poll?.options?.[t.optionIndex]?.text ||
                      `Option ${t.optionIndex}`}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {poll?.isResolved ? "Resolved" : isEnded ? "Ended" : "Active"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            You haven't traded on this market.
          </p>
        )}
      </div>

      {/* Action Button */}
      <div>
        {poll.isResolved ? (
          user && userTrades.length > 0 ? (
            didUserWin ? (
              poll?.rewardClaimed || contractData.rewardClaimed || claimed ? (
                <button className="w-full bg-gray-300 text-gray-700 font-semibold py-2 rounded-md cursor-not-allowed">
                  Reward claimed
                </button>
              ) : (
                <button
                  onClick={() => redeemMutation.mutate()}
                  disabled={redeemMutation.isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition"
                >
                  {redeemMutation.isLoading ? "Claiming..." : "Redeem"}
                </button>
              )
            ) : (
              <div className="text-red-500 font-semibold text-center">
                You lost
              </div>
            )
          ) : (
            <button className="w-full bg-gray-300 text-gray-700 font-semibold py-2 rounded-md cursor-not-allowed">
              Ended
            </button>
          )
        ) : isEnded ? (
          <button className="w-full bg-gray-300 text-gray-700 font-semibold py-2 rounded-md cursor-not-allowed">
            Ended
          </button>
        ) : null}
      </div>
    </div>
  );
}
