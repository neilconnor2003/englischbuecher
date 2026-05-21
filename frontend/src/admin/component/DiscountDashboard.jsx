
import axios from "axios";
import config from "../../config";
import React, { useEffect, useState } from "react";

const DiscountDashboard = () => {
    const [discounts, setDiscounts] = useState([]);
    const [form, setForm] = useState({
        code: "",
        type: "PERCENT",
        value: "",
        expiry_date: "",
        is_active: true
    });

    const [editingId, setEditingId] = useState(null);

    // ✅ Load discounts
    const fetchDiscounts = async () => {
        const res = await axios.get(`${config.API_URL}/api/discounts`);
        setDiscounts(res.data);
    };

    useEffect(() => {
        fetchDiscounts();
    }, []);

    // ✅ Save (add/update)
    const handleSave = async () => {
        if (!form.code || !form.value) return alert("Code + value required");

        if (editingId) {
            await axios.put(`${config.API_URL}/api/discounts/${editingId}`, form);
        } else {
            await axios.post(`${config.API_URL}/api/discounts`, form);
        }

        setForm({
            code: "",
            type: "PERCENT",
            value: "",
            expiry_date: "",
            is_active: true
        });
        setEditingId(null);
        fetchDiscounts();
    };

    // ✅ Edit
    const handleEdit = (d) => {
        setForm(d);
        setEditingId(d.id);
    };

    const [statusFilter, setStatusFilter] = useState("all");

    const filteredDiscounts = discounts.filter(d => {
        if (statusFilter === "active") return d.is_active;
        if (statusFilter === "inactive") return !d.is_active;
        return true;
    });


    return (
        <div className="p-6 max-w-5xl mx-auto">

            <h1 className="text-2xl font-bold mb-4">
                Discount Codes
            </h1>

            {/* FORM */}
            <div className="bg-white p-4 rounded shadow mb-6">
                <div className="grid grid-cols-5 gap-3">

                    <input
                        placeholder="CODE"

                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        className="border p-2 rounded"
                    />

                    <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="border p-2 rounded"
                    >
                        <option value="PERCENT">Percent</option>
                        <option value="FIXED">Fixed €</option>
                        <option value="FREE_SHIPPING">Free Shipping</option>
                    </select>

                    <input
                        placeholder="Value"
                        value={form.value}
                        onChange={(e) => setForm({ ...form, value: e.target.value })}
                        className="border p-2 rounded"
                    />

                    <input
                        type="date"
                        value={form.expiry_date || ""}
                        onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                        className="border p-2 rounded"
                    />

                    <button
                        onClick={handleSave}
                        className="bg-purple-600 text-white rounded px-3"
                    >
                        {editingId ? "Update" : "Add"}
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="bg-white rounded shadow overflow-hidden">

                <div className="mb-4 flex gap-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border px-3 py-2 rounded"
                    >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-3 text-left">Code</th>
                            <th>Type</th>
                            <th>Value</th>
                            <th>Expiry</th>
                            <th>Status</th>
                            <th />
                        </tr>
                    </thead>


                    <tbody>
                        {/*{discounts.map(d => {*/}
                        {filteredDiscounts.map(d => {
                            const isExpired = d.expiry_date && new Date(d.expiry_date) < new Date();

                            return (
                                <tr key={d.id} className="border-t hover:bg-purple-50 transition">

                                    <td className="p-4 font-bold text-purple-800">
                                        {d.code}
                                    </td>

                                    <td className="p-4">
                                        <span className="text-sm font-semibold">
                                            {d.type === "PERCENT" ? "Percentage" :
                                                d.type === "FIXED" ? "Fixed (€)" :
                                                    "Free Shipping"}
                                        </span>
                                    </td>

                                    <td className="p-4 font-bold text-green-600">
                                        {d.type === "PERCENT" ? `${d.value}%` :
                                            d.type === "FIXED" ? `€${d.value}` :
                                                "-"}
                                    </td>

                                    <td className="p-4 text-gray-600">
                                        {d.expiry_date || "-"}
                                    </td>

                                    <td className="p-4">
                                        <span className={`px-3 py-1 text-xs rounded-full font-bold
            ${!d.is_active ? "bg-gray-200 text-gray-600" :
                                                isExpired ? "bg-red-100 text-red-700" :
                                                    "bg-green-100 text-green-700"}
          `}>
                                            {!d.is_active ? "Inactive" :
                                                isExpired ? "Expired" :
                                                    "Active"}
                                        </span>
                                    </td>

                                    <td className="p-4 flex gap-2 justify-end">

                                        {/* ✅ TOGGLE */}
                                        <button
                                            onClick={async () => {
                                                await axios.patch(`${config.API_URL}/api/discounts/${d.id}/toggle`);
                                                fetchDiscounts();
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold
              ${d.is_active ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
            `}
                                        >
                                            {d.is_active ? "Deactivate" : "Activate"}
                                        </button>

                                        {/* EDIT */}
                                        <button onClick={() => handleEdit(d)}>
                                            ✏️
                                        </button>

                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

export default DiscountDashboard;
