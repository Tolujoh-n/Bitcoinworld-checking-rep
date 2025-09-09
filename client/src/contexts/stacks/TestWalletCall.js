import React from "react";
import {
  AppConfig,
  UserSession,
  showConnect,
  openSTXTransfer,
} from "@stacks/connect";
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
} from "@stacks/transactions";
// import { StacksTestnet } from "@stacks/network";
import { useConnect, useStacks } from "@stacks/connect-react";
import { request, openContractCall } from "@stacks/connect";
import {
  contractPrincipalCV,
  stringUtf8CV,
  fetchCallReadOnlyFunction,
} from "@stacks/transactions";

// --- Setup Stacks session ---
const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });
const network = "testnet";

const appDetails = {
  name: "Bitcoinworld",
  icon: "https://imglink.io/i/139bee27-a14b-4e2d-99c3-3b05d9cb6e53.png",
};

// ---------------- Wallet helpers ----------------
function isSignedIn() {
  return userSession.isUserSignedIn();
}

function getWalletAddress() {
  if (!isSignedIn()) return null;
  return userSession.loadUserData().profile.stxAddress.testnet;
}

function authenticate() {
  return new Promise((resolve, reject) => {
    showConnect({
      appDetails,
      userSession,
      onFinish: () => {
        const address = getWalletAddress();
        console.log("Wallet connected:", address);
        resolve(address);
      },
      onCancel: () => {
        console.warn("Wallet connect cancelled");
        reject(new Error("Wallet connection cancelled"));
      },
    });
  });
}

// ---------------- React component ----------------
const TestSTXTransfer = () => {
  const { doContractCall } = useConnect();
  const handleConnect = async () => {
    try {
      await authenticate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransfer = async () => {
    try {
      if (!isSignedIn()) {
        await authenticate();
      }

      const options = {
        recipient: "ST3J2GVMMM2R07ZFBJDWTYEYAR8FZH5WKDTFJ9AHA", // testnet address
        amount: "1000000", // must be string, in microstacks
        memo: "Test transfer",
      };

      console.log("Opening wallet for STX transfer:", options);

      const response = await request("stx_transferStx", options);

      console.log("Transfer submitted, txid:", response.txId);
      console.log(
        "🔗 View in explorer:",
        `https://explorer.stacks.co/txid/${response.txId}?chain=testnet`
      );
    } catch (err) {
      console.error("Error during transfer:", err);
    }
  };

  async function callContract() {
    const txOptions = {
      contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      contractName: "my-contract",
      functionName: "transfer",
      functionArgs: [],
      anchorMode: AnchorMode.Any,
    };

    const transaction = await openContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction({ transaction });

    console.log("Transaction ID:", broadcastResponse.txid);
  }

  // Example: a public (write) function using openContractCall
  const writeMessage = async (message) => {
    try {
      await doContractCall({
        network: "testnet",
        contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        contractName: "my-contract",
        functionName: "set-message",
        functionArgs: [stringUtf8CV(message)],
        postConditions: [], // Optional post-conditions
        onFinish: (data) => {
          console.log("Transaction finished:", data);
        },
        onCancel: () => {
          console.log("User cancelled transaction");
        },
      });
    } catch (error) {
      console.error("Error calling write function:", error);
    }
  };

  // Example: a read-only function
  const readMessage = async () => {
    try {
      const functionName = "get-message";
      const functionArgs = [stringUtf8CV("id1")]; // Arguments for the function

      const result = await fetchCallReadOnlyFunction({
        network: "testnet",
        contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        contractName: "my-contract",
        functionName,
        functionArgs,
        senderAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", // Your sender address
      });
      console.log("Read function result:", result);
    } catch (error) {
      console.error("Error calling read function:", error);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <button className="btn-primary" onClick={handleConnect}>
          Connect Wallet
        </button>
        <button className="btn-secondary" onClick={handleTransfer}>
          Normal Transfer
        </button>
        <button className="btn-secondary" onClick={callContract}>
          Contract Transfer
        </button>
      </div>
      <div>
        <button onClick={readMessage}>Read Message</button>
        <button onClick={() => writeMessage("Hello, Stacks!")}>
          Write Message
        </button>
      </div>
    </>
  );
};

export default TestSTXTransfer;
