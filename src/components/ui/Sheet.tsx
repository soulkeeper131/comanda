"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

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
  return (
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
                "fixed inset-x-0 bottom-0 z-50 rounded-t-sheet bg-white shadow-card-3 safe-bottom",
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
            <motion.div
              className={[
                "fixed inset-x-4 bottom-1/2 translate-y-1/2 z-50 max-w-md mx-auto",
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
          )}
        </>
      )}
    </AnimatePresence>
  );
}
