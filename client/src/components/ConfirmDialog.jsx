import { createContext, useCallback, useContext, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setDialog({
      title: options.title || 'Confirm action',
      message: options.message || 'Are you sure?',
      confirmLabel: options.confirmLabel || 'Confirm',
      tone: options.tone || 'danger',
      resolve,
    });
  }), []);

  const close = (result) => {
    if (dialog?.resolve) dialog.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">{dialog.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{dialog.message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button type="button" onClick={() => close(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
