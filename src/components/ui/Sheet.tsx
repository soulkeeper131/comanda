"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "center" — прозорец в средата на по-голям екран (на телефон става лист
   *  отдолу); "bottom" — лист отдолу на всички екрани. */
  placement?: "center" | "bottom";
  className?: string;
};

/** Телефон — под sm (640px). */
function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

/**
 * Видимата част на екрана над клавиатурата. На iPhone `fixed bottom-0` стои
 * зад отворената клавиатура и полетата отдолу не се виждат — затова листът
 * се вдига с височината на клавиатурата и се смалява до видимото.
 */
function useKeyboardInset(active: boolean): { bottom: number; height: number | null } {
  const [inset, setInset] = useState<{ bottom: number; height: number | null }>({ bottom: 0, height: null });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset({ bottom, height: vv.height });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return inset;
}

export function Sheet({ open, onClose, children, placement = "center", className = "" }: SheetProps) {
  // Портал към body: родител с transform/backdrop-filter (напр. Topbar с
  // backdrop-blur) става containing block за `fixed` и листът се отрязваше.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const phone = useIsPhone();
  const asBottom = placement === "bottom" || phone;
  const keyboard = useKeyboardInset(open && asBottom);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Докато е отворен: страницата отдолу не се скролва (на телефона скролът
  // „пробиваше" към нея), а Escape затваря.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Поле, на което се натисне, се показва над клавиатурата.
  const keepFocusedVisible = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  };

  if (!mounted) return null;

  const maxHeight = keyboard.height ? `${Math.round(keyboard.height * 0.94)}px` : "92dvh";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          {asBottom ? (
            <motion.div
              role="dialog"
              aria-modal="true"
              onFocus={keepFocusedVisible}
              style={{ bottom: keyboard.bottom, maxHeight }}
              className={[
                "fixed inset-x-0 z-[61] mx-auto flex max-w-2xl flex-col rounded-t-sheet bg-white shadow-card-3",
                "overflow-y-auto overscroll-contain safe-bottom",
                // Отстъпът на центрирания вариант (p-6) — и на телефона.
                placement === "center" ? "px-5 pb-5 pt-2" : "",
                className,
              ]
                .filter(Boolean)
                .join(" ")}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
            >
              <div aria-hidden className="mx-auto mb-2 mt-1 h-1.5 w-10 shrink-0 rounded-full bg-line" />
              {children}
            </motion.div>
          ) : (
            // Центрира flex обвивка, не translate: Framer Motion пише своя
            // transform (scale) и изтриваше translate-y — горната част на
            // висока форма излизаше извън екрана.
            <div className="pointer-events-none fixed inset-0 z-[61] flex items-center justify-center p-4">
              <motion.div
                role="dialog"
                aria-modal="true"
                className={[
                  "pointer-events-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain",
                  "rounded-lg bg-white shadow-card-3 p-6",
                  className,
                ]
                  .filter(Boolean)
                  .join(" ")}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                {children}
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
