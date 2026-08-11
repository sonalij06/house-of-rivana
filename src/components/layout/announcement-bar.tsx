"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const DISMISS_KEY = "rivana:announcement-dismissed";

/**
 * The dismissal lives in sessionStorage, which is an external store — reading it
 * through useSyncExternalStore keeps render pure and avoids a state-setting
 * effect that would double-render on every mount.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getDismissed() {
  return sessionStorage.getItem(DISMISS_KEY);
}

function getServerDismissed() {
  return null;
}

function dismiss(text: string) {
  sessionStorage.setItem(DISMISS_KEY, text);
  for (const listener of listeners) listener();
}

export function AnnouncementBar({ text }: { text: string }) {
  const dismissed = useSyncExternalStore(subscribe, getDismissed, getServerDismissed);
  const visible = dismissed !== text;

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden bg-ink text-cream"
        >
          <div className="container-site relative flex items-center justify-center py-2.5">
            <p className="text-center text-[0.6875rem] font-medium uppercase tracking-[0.18em]">
              {text}
            </p>
            <button
              type="button"
              onClick={() => dismiss(text)}
              aria-label="Dismiss announcement"
              className="absolute right-4 p-1 text-cream/60 transition-colors hover:text-cream md:right-10"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
