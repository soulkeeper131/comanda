"use client";

import { useState } from "react";
import { Input } from "./ui/Input";
import { Icon } from "./ui/Icon";
import { locateAddress, useAddressSearch, type AddressHit } from "./useAddressSearch";

/**
 * Поле за адрес: предложения, докато човекът пише, и „Моето местоположение“
 * за този, който е в самия имот. Адресът се приема само избран — така имотът
 * има точни координати за инспектора.
 */
export default function AddressPicker({
  picked,
  onPick,
  initialQuery = "",
  placeholder = "Улица и номер, напр. Оборище 45",
}: {
  picked: AddressHit | null;
  onPick: (hit: AddressHit | null) => void;
  initialQuery?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(picked?.label ?? initialQuery);
  const { hits, searching, error } = useAddressSearch(query, !picked);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const choose = (hit: AddressHit) => {
    setQuery(hit.label);
    setLocateError("");
    onPick(hit);
  };

  const useMyLocation = async () => {
    setLocating(true);
    setLocateError("");
    const r = await locateAddress();
    setLocating(false);
    if ("error" in r) setLocateError(r.error);
    else choose(r.hit);
  };

  if (picked) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-state-ok/40 bg-state-ok/5 px-3 py-2.5">
        <Icon name="pin" size={18} className="mt-0.5 shrink-0 text-state-ok" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{picked.label}</p>
          {picked.display_name !== picked.label && <p className="truncate text-xs text-muted">{picked.display_name}</p>}
          {!picked.precise && (
            <p className="mt-0.5 text-xs text-state-warning">Без номер — уточнете входа и етажа в бележките за достъп.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onPick(null);
            setQuery(picked.label);
          }}
          className="-my-1 min-h-touch shrink-0 px-1 text-sm font-semibold text-brand-primary"
        >
          Смени
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter избира първото предложение, вместо да праща формата.
            if (e.key === "Enter") {
              e.preventDefault();
              if (hits[0]) choose(hits[0]);
            }
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Адрес"
          className="pr-10"
        />
        {searching && (
          <span
            aria-hidden
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-brand-primary"
          />
        )}
      </div>

      {hits.length > 0 && (
        // В потока на формата, не върху следващите полета — на телефона
        // падащото меню закриваше полетата и бутоните.
        <ul className="mt-1 overflow-hidden rounded-card border border-line bg-white shadow-card-1" role="listbox" aria-label="Предложения">
          {hits.map((hit, i) => (
            <li key={`${hit.lat},${hit.lng},${i}`} className="border-b border-line last:border-0">
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => choose(hit)}
                className="flex min-h-touch w-full items-start gap-2 px-3 py-2 text-left hover:bg-brand-bg active:bg-brand-bg"
              >
                <Icon name="pin" size={16} className={`mt-0.5 shrink-0 ${hit.precise ? "text-brand-primary" : "text-muted"}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{hit.label}</span>
                  {hit.display_name !== hit.label && <span className="block truncate text-xs text-muted">{hit.display_name}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && error && query.trim().length >= 3 && <p className="mt-1 text-xs font-medium text-state-danger">{error}</p>}
      {query.trim().length > 0 && query.trim().length < 3 && <p className="mt-1 text-xs text-muted">Още няколко букви…</p>}

      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="mt-1 flex min-h-touch items-center gap-1.5 text-sm font-semibold text-brand-primary disabled:opacity-60"
      >
        <Icon name="map" size={16} />
        {locating ? "Определяме къде сте…" : "В имота съм — вземи моето местоположение"}
      </button>
      {locateError && <p className="text-xs font-medium text-state-danger">{locateError}</p>}
    </div>
  );
}
