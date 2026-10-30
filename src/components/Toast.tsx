import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
  placement: 'top' | 'bottom' | 'bottom-raised'; // top on desktop (the bottom holds the controls), above the sheet on phones
}

const VISIBLE_MS = 5000;

export function Toast({ toast, onDismiss, placement }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${
        placement === 'top' ? 'top-6' : placement === 'bottom-raised' ? 'bottom-40' : 'bottom-8'
      }`}
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: placement === 'top' ? -16 : 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'top' ? -8 : 8, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
            className="glass pointer-events-auto flex max-w-[520px] items-center gap-4 rounded-2xl !bg-[var(--surface-strong)] py-2.5 pl-4 pr-2.5"
          >
            <span dir="auto" className="min-w-0 truncate text-[13.5px] text-ink">
              {toast.text}
            </span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  onDismiss();
                }}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-normal text-ink underline-offset-4 transition-colors hover:bg-line"
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
