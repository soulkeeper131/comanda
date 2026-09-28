"use client";

import { useState } from "react";

/**
 * Формата за запитване на публичната страница. Преди беше само изглед —
 * бутонът не пращаше нищо и запитванията се губеха.
 */
export default function InquiryForm({ services }: { services: string[] }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    city: "",
    property_kind: "Апартамент",
    service: services[0] ?? "Друго",
    message: "",
    website: "", // скрито поле срещу ботове
  });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.full_name.trim() || !form.email.trim()) return setError("Име и имейл са задължителни.");
    setState("sending");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("idle");
        return setError(res.status === 429 ? "Твърде много опити. Опитайте след минута." : d.error || "Не успяхме да изпратим. Опитайте отново.");
      }
      setState("sent");
    } catch {
      setState("idle");
      setError("Няма връзка. Опитайте отново.");
    }
  };

  if (state === "sent") {
    return (
      <div className="l-form" style={{ textAlign: "center" }}>
        <h3 style={{ fontSize: 20, marginBottom: 8 }}>Благодарим!</h3>
        <p className="muted">Получихме запитването и ще ви отговорим до 24 часа.</p>
      </div>
    );
  }

  return (
    <form className="l-form" onSubmit={submit} noValidate>
      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="label" htmlFor="inq-name">Име</label>
          <input id="inq-name" className="input" placeholder="Име и фамилия" autoComplete="name" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="label" htmlFor="inq-phone">Телефон</label>
          <input id="inq-phone" className="input" type="tel" placeholder="+359 …" autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="inq-email">Имейл</label>
        <input id="inq-email" className="input" type="email" placeholder="за да ти изпратим офертата" autoComplete="email" value={form.email} onChange={set("email")} />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="label" htmlFor="inq-city">Град / район</label>
          <input id="inq-city" className="input" placeholder="напр. София, Лозенец" value={form.city} onChange={set("city")} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="label" htmlFor="inq-kind">Тип имот</label>
          <select id="inq-kind" className="select" value={form.property_kind} onChange={set("property_kind")}>
            <option>Апартамент</option>
            <option>Студио</option>
            <option>Къща</option>
            <option>Вила</option>
            <option>Офис</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="inq-service">Какво те интересува</label>
        <select id="inq-service" className="select" value={form.service} onChange={set("service")}>
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
          <option>Еднократна услуга</option>
          <option>Друго — описвам по-долу</option>
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="inq-msg">Разкажи накратко</label>
        <textarea
          id="inq-msg"
          className="textarea"
          placeholder="Откога е празен имотът, има ли известни проблеми, какво точно ти трябва"
          value={form.message}
          onChange={set("message")}
        />
      </div>
      {/* Скрито от хората; ботовете го попълват и заявката се игнорира. */}
      <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
      {error && (
        <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 10 }} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="l-btn l-btn-p" style={{ width: "100%" }} disabled={state === "sending"}>
        {state === "sending" ? "Изпращане…" : "Изпрати запитването"}
      </button>
      <p className="tiny muted" style={{ marginTop: 11, textAlign: "center" }}>
        Отговаряме до 24 часа. Данните се използват само за отговора —{" "}
        <a href="/privacy" style={{ textDecoration: "underline" }}>
          поверителност
        </a>
        .
      </p>
    </form>
  );
}
