
import React, { useState } from "react";
import axios from "axios";
import config from "../../config";

const WalletAdmin = () => {
    //const [userId, setUserId] = useState("");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [email, setEmail] = useState("");


    const [transactions, setTransactions] = useState([]);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);


    const handleFetch = async () => {
        if (!email) {
            alert("Email required");
            return;
        }

        setLoading(true);

        try {
            const resBalance = await axios.get(
                `${config.API_URL}/api/wallet/admin/balance?email=${email}`,
                { withCredentials: true }
            );

            const resTx = await axios.get(
                `${config.API_URL}/api/wallet/admin/transactions?email=${email}`,
                { withCredentials: true }
            );

            setBalance(Number(resBalance.data.balance || 0));
            setTransactions(resTx.data || []);

        } catch (err) {
            console.error(err);
            alert("Error fetching wallet data");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {

        if (!email || !amount) {
            alert("Email and amount required");
            return;
        }
        /*if (!userId || !amount) {
            alert("User ID and amount required");
            return;
        }*/

        try {
            await axios.post(`${config.API_URL}/api/wallet/add`, {
                email: email,
                amount: Number(amount),
                reason: reason || "Admin credit"
            }, { withCredentials: true });

            alert("Wallet updated ✅");

            //setUserId("");
            setEmail("");
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
                    //type="number"
                    type="email"
                    //placeholder="User ID"
                    placeholder="User Email"
                    value={email}
                    //onChange={(e) => setUserId(e.target.value)}
                    onChange={(e) => setEmail(e.target.value)}
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


                <button
                    onClick={handleFetch}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    Load Wallet
                </button>

                {balance !== null && (
                    <div className="mt-4 p-3 bg-purple-50 rounded">
                        <strong>Balance:</strong> €{balance.toFixed(2)}
                    </div>
                )}


                {transactions.length > 0 && (
                    <div className="mt-4">
                        <h3 className="font-bold mb-2">Transactions</h3>

                        <div className="border rounded">
                            {transactions.map(tx => (
                                <div key={tx.id} className="flex justify-between p-2 border-b">

                                    <div>
                                        <div className="font-medium">{tx.reason}</div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </div>
                                    </div>

                                    <div
                                        className={`font-bold ${tx.type === "CREDIT" ? "text-green-600" : "text-red-600"
                                            }`}
                                    >
                                        {tx.type === "CREDIT" ? "+" : "-"}€
                                        {Number(tx.amount).toFixed(2)}
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};

export default WalletAdmin;
