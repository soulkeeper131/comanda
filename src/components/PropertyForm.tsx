"use client";

import { useState } from "react";

type PropertyFormData = {
  name: string;
  addr: string;
  type: string;
  access: string;
};

export default function PropertyForm({ onAdd, onClose }: { onAdd: (data: PropertyFormData) => void; onClose: () => void }) {
  const [data, setData] = useState<PropertyFormData>({ name: "", addr: "", type: "apartment", access: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim() || !data.addr.trim()) return;
    onAdd(data);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-1/2 translate-y-1/2 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: "#006494" }}>＋ Нов обект</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Име на имота"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-base"
            style={{ borderColor: "#e4e9f0", fontSize: 16 }}
            required
          />
          <input
            type="text"
            placeholder="Адрес"
            value={data.addr}
            onChange={(e) => setData({ ...data, addr: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-base"
            style={{ borderColor: "#e4e9f0", fontSize: 16 }}
            required
          />
          <select
            value={data.type}
            onChange={(e) => setData({ ...data, type: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-base"
            style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}
          >
            <option value="apartment">Апартамент</option>
            <option value="house">Къща</option>
            <option value="studio">Студио</option>
            <option value="villa">Вила</option>
          </select>
          <textarea
            placeholder="Достъп (ключове, кодове, бележки)"
            value={data.access}
            onChange={(e) => setData({ ...data, access: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-base resize-none"
            style={{ borderColor: "#e4e9f0", fontSize: 16, minHeight: 80 }}
            rows={2}
          />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "#d0e5ff", color: "#247ba0" }}>
              Отказ
            </button>
            <button type="submit" className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
              Добави
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
