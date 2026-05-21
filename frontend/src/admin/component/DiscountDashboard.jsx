
import axios from "axios";
import config from "../../config";
import { Plus, Edit, Trash2 } from "lucide-react";
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

    // ✅ Delete
    const handleDelete = async (id) => {
        if (!window.confirm("Delete this discount?")) return;

        await axios.delete(`${config.API_URL}/api/discounts/${id}`);
        fetchDiscounts();
    };

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
                        {discounts.map(d => (
                            <tr key={d.id} className="border-t">
                                <td className="p-3 font-bold">{d.code}</td>
                                <td>{d.type}</td>
                                <td>{d.value}</td>
                                <td>{d.expiry_date || "-"}</td>
                                <td>{d.is_active ? "Active" : "Inactive"}</td>

                                <td className="flex gap-2 justify-end pr-3">
                                    <button onClick={() => handleEdit(d)}>
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(d.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

export default DiscountDashboard;
