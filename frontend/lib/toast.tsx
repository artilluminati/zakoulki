"use client";

import {
    createContext,
    useCallback,
    useContext,
    useState,
    type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
    id: number;
    kind: ToastKind;
    message: string;
}

interface ToastContextValue {
    toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0 text-lime-400" />,
    error: <XCircle className="h-5 w-5 shrink-0 text-red-400" />,
    info: <Info className="h-5 w-5 shrink-0 text-sky-400" />,
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback(
        (message: string, kind: ToastKind = "info") => {
            const id = nextId++;
            setToasts((prev) => [...prev, { id, kind, message }]);
            setTimeout(() => dismiss(id), 4500);
        },
        [dismiss],
    );

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[999] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border border-white/10 bg-slate-900/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur"
                    >
                        {ICONS[t.kind]}
                        <span className="flex-1">{t.message}</span>
                        <button
                            onClick={() => dismiss(t.id)}
                            className="shrink-0 text-white/40 hover:text-white"
                            aria-label="Закрыть уведомление"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error(
            "useToast должен использоваться внутри <ToastProvider>",
        );
    }
    return ctx.toast;
}
