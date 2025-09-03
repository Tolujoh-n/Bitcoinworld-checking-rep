import React from "react";
import {
  AppConfig,
  UserSession,
  showConnect,
  openSTXTransfer,
} from "@stacks/connect";
import { StacksTestnet } from "@stacks/network";
import { request } from "@stacks/connect";

// --- Setup Stacks session ---
const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });
const network = new StacksTestnet();

const appDetails = {
  name: "BitcoinWorld Test",
  icon: "https://BitcoinWorld.app/BitcoinWorld.png",
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

  return (
    <div className="flex flex-col gap-4">
      <button className="btn-primary" onClick={handleConnect}>
        Connect Wallet
      </button>
      <button className="btn-secondary" onClick={handleTransfer}>
        Test STX Transfer
      </button>
    </div>
  );
};

export default TestSTXTransfer;
