import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";
import { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  itemName?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  message,
  itemName,
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-md rounded-3xl border border-border-subtle bg-secondary/90 backdrop-blur-glass p-6 shadow-xl"
          >
            {/* Icon */}
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full mb-4 ${
                isDestructive
                  ? "bg-red-500/20"
                  : "bg-blue-500/20"
              }`}
            >
              {isDestructive ? (
                <Trash2 className="h-6 w-6 text-red-400" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-blue-400" />
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-white mb-2">
              {title}
            </h2>

            {/* Message */}
            <p className="text-sm text-white/70 mb-3">
              {message}
            </p>

            {/* Item name highlight */}
            {itemName && (
              <div className="mb-4 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <p className="text-xs text-white/60 mb-1">Item:</p>
                <p className="text-sm font-mono text-white/90 truncate">
                  {itemName}
                </p>
              </div>
            )}

            {/* Custom content (for inputs, etc) */}
            {children && (
              <div className="mb-4">
                {children}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 rounded-xl border border-border-subtle bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50 [-webkit-app-region:no-drag]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 [-webkit-app-region:no-drag] ${
                  isDestructive
                    ? "bg-red-600/80 hover:bg-red-600"
                    : "bg-blue-600/80 hover:bg-blue-600"
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Processing...
                  </span>
                ) : isDestructive ? (
                  "Delete"
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
