import { Cl, uintCV, intCV, AnchorMode, stringAsciiCV } from "@stacks/transactions";
import { callContract, readOnlyCall, getWalletAddress } from "./stacksClient";

// 🔹 Replace with actual deployed values
const CONTRACT_ADDRESS = "ST1PSHE32YTEE21FGYEVTA24N681KRGSQM4VF9XZP";
const CONTRACT_NAME = "market";

// ------------------- WRITE FUNCTIONS -------------------
export async function createMarket(initialLiquidity) {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "create",
    functionArgs: [uintCV(initialLiquidity)],
  });
}

export async function addLiquidity(amount) {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "add-liquidity",
    functionArgs: [Cl.uint(amount)],
  });
}

export async function buyYes(amount) {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "buy-yes",
    functionArgs: [Cl.uint(amount)],
  });
}

export async function buyNo(amount) {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "buy-no",
    functionArgs: [Cl.uint(amount)],
  });
}

// export async function resolveMarket(outcome) {
//   return callContract({
//     contractAddress: CONTRACT_ADDRESS,
//     contractName: CONTRACT_NAME,
//     functionName: "resolve",
//     functionArgs: [Cl.string(outcome)],
//   });
// }

export async function redeem() {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "redeem",
    functionArgs: [],
  });
}

export async function withdrawSurplus() {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "withdraw-surplus",
    functionArgs: [],
  });
}

export async function pause() {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "pause",
    functionArgs: [],
  });
}

export async function unpause() {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "unpause",
    functionArgs: [],
  });
}

// ------------------- TOKEN HELPERS -------------------
export async function tokenMint(amount, recipient) {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "mint",
    functionArgs: [Cl.uint(amount), Cl.principal(recipient)],
  });
}

export async function tokenBurn(amount) {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "burn",
    functionArgs: [Cl.uint(amount)],
  });
}

export async function tokenTransfer(amount, sender, recipient) {
  return callContract({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "transfer",
    functionArgs: [
      Cl.uint(amount),
      Cl.principal(sender),
      Cl.principal(recipient),
    ],
  });
}

// ------------------- READ-ONLY GETTERS -------------------
export async function getQYes() {
  return readOnlyCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-q-yes",
    senderAddress: getWalletAddress(),
  });
}

export async function getQNo() {
  return readOnlyCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-q-no",
    senderAddress: getWalletAddress(),
  });
}

export async function getPool() {
  return readOnlyCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-pool",
    senderAddress: getWalletAddress(),
  });
}

export async function getStatus() {
  return readOnlyCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-status",
    senderAddress: getWalletAddress(),
  });
}

export async function getOutcome() {
  return readOnlyCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-outcome",
    senderAddress: getWalletAddress(),
  });
}

export async function getB() {
  return readOnlyCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-b",
    senderAddress: getWalletAddress(),
  });
}
