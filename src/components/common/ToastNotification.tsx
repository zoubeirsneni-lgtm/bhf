import React from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ToastNotification: React.FC = () => {
  const { toastMessage, clearToast, setActiveClientTab, setCurrentRole } = useApp();

  if (!toastMessage) return null;

  const isSuccess = toastMessage.type === 'success';
  const isWarning = toastMessage.type === 'warning';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed top-14 right-4 z-50 max-w-sm w-full shadow-2xl rounded-2xl overflow-hidden border border-stone-200 bg-white/95 backdrop-blur-md"
      >
        <div className="p-4 flex items-start gap-3">
          <div
            className={`p-2 rounded-xl flex-shrink-0 ${
              isSuccess
                ? 'bg-emerald-100 text-emerald-700'
                : isWarning
                ? 'bg-amber-100 text-amber-700'
                : 'bg-stone-900 text-white'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : isWarning ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5 animate-bounce" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-stone-900 leading-tight mb-1">
              {toastMessage.title}
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed break-words">
              {toastMessage.body}
            </p>

            {toastMessage.title.includes('Statut commande') && (
              <button
                onClick={() => {
                  setCurrentRole('client');
                  setActiveClientTab('tracking');
                  clearToast();
                }}
                className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 underline underline-offset-2"
              >
                <span>Voir le suivi en direct</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={clearToast}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`h-1 w-full ${
            isSuccess
              ? 'bg-emerald-500'
              : isWarning
              ? 'bg-amber-500'
              : 'bg-stone-900'
          }`}
        />
      </motion.div>
    </AnimatePresence>
  );
};
