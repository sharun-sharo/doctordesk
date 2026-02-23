import Modal from './Modal';

/**
 * Confirmation dialog with Cancel and Confirm actions.
 * Use for destructive or important confirmations (e.g. delete).
 */
export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'danger', // danger | primary
  loading = false,
}) {
  const handleConfirm = () => {
    onConfirm?.();
  };

  const confirmClass =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500';

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {message && <p className="mb-6 text-sm text-slate-600">{message}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-2 disabled:opacity-60"
          aria-label={cancelLabel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${confirmClass}`}
          aria-label={confirmLabel}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
