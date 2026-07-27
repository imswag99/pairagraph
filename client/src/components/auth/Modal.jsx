export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-charcoal/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-modal-in rounded-2xl bg-paper p-7 shadow-modal"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-xl text-charcoal">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-lg leading-none text-charcoal/40 transition hover:text-charcoal"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
