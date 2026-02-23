import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastId = 0;

// Global state for toasts
let globalToasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

function notifyListeners() {
  listeners.forEach((listener) => listener(globalToasts));
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  const addToast = (message: string, type: ToastType = "info", duration = 3000) => {
    const id = `toast-${toastId++}`;
    const newToast: Toast = { id, message, type, duration };
    globalToasts = [...globalToasts, newToast];
    notifyListeners();

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  };

  const removeToast = (id: string) => {
    globalToasts = globalToasts.filter((t) => t.id !== id);
    notifyListeners();
  };

  return { toasts, addToast, removeToast };
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 20 }}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-glass ${
              toast.type === "success"
                ? "border-green-500/30 bg-green-500/10"
                : toast.type === "error"
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-blue-500/30 bg-blue-500/10"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
            )}
            {toast.type === "error" && (
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            {toast.type === "info" && (
              <div className="h-5 w-5 rounded-full border-2 border-blue-400/50 flex-shrink-0 mt-0.5" />
            )}

            <p
              className={`text-sm flex-1 ${
                toast.type === "success"
                  ? "text-green-300"
                  : toast.type === "error"
                    ? "text-red-300"
                    : "text-blue-300"
              }`}
            >
              {toast.message}
            </p>

            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-white/50 hover:text-white/80 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
