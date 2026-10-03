"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "center" mimics the existing modal-style forms (TaskForm/PropertyForm).
   *  "bottom" is a mobile bottom sheet anchored to the viewport bottom. */
  placement?: "center" | "bottom";
  className?: string;
};

export function Sheet({ open, onClose, children, placement = "center", className = "" }: SheetProps) {
  // Портал към body: родител с transform/backdrop-filter (напр. Topbar с
  // backdrop-blur) става containing block за `fixed` и листът се отрязваше.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          {placement === "bottom" ? (
            <motion.div
              className={[
                "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl rounded-t-sheet bg-white shadow-card-3 safe-bottom",
                className,
              ]
                .filter(Boolean)
                .join(" ")}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              {children}
            </motion.div>
          ) : (
            // Центрира flex обвивка, не translate: Framer Motion пише своя
            // transform (scale) и изтриваше translate-y — горната част на
            // висока форма излизаше извън екрана на телефон.
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className={[
                  "pointer-events-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto",
                  "rounded-lg bg-white shadow-card-3 p-6 safe-bottom",
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
