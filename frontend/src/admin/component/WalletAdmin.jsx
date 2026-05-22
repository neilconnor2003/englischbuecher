
import React, { useState } from "react";
import axios from "axios";
import config from "../../config";

const WalletAdmin = () => {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleAdd = async () => {
    if (!userId || !amount) {
      alert("User ID and amount required");
      return;
    }

    try {
      await axios.post(`${config.API_URL}/api/wallet/add`, {
        user_id: Number(userId),
        amount: Number(amount),
        reason: reason || "Admin credit"
      }, { withCredentials: true });

      alert("Wallet updated ✅");

      setUserId("");
      setAmount("");
      setReason("");

    } catch (err) {
      console.error(err);
      alert("Error updating wallet");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">

      <h1 className="text-2xl font-bold mb-4">
        Wallet Admin
      </h1>

      <div className="bg-white p-4 rounded shadow space-y-4">

        <input
          type="number"
          //placeholder="User ID"
          placeholder="User Email"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 w-full"
        />

        <input
          type="number"
          placeholder="Amount (€)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border p-2 w-full"
        />

        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="border p-2 w-full"
        />

        <button
          onClick={handleAdd}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add to Wallet
        </button>

      </div>
    </div>
  );
};

export default WalletAdmin;
