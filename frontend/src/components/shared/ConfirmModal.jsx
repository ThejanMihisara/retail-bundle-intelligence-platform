import React from 'react';
import { createPortal } from 'react-dom';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-up"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--card-border)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Warning Icon */}
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Header */}
        <h3 className="text-base font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        
        {/* Message */}
        <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg transition-all hover:bg-[var(--btn-ghost-bg-hover)]"
            style={{
              background: 'var(--btn-ghost-bg)',
              border: '1px solid var(--btn-ghost-border)',
              color: 'var(--text-body)',
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg text-white transition-all active:scale-95 shadow-md shadow-red-500/15"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
