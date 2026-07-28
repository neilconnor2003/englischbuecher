// frontend/src/components/common/BrandModal.jsx
//
// Reusable branded modal/popup, styled after the delete-account confirmation
// modal on the Profile page (rounded card, colored icon circle, Fraunces
// italic title, purple/red button pair). Use this instead of building a new
// inline-styled overlay, or instead of antd's <Modal> — antd's default
// modal styling doesn't match the rest of the site's brand at all.
//
// Two ways to use it:
//   1. Simple confirm-style dialog — pass `message`, `primaryLabel`,
//      `onPrimary` (mirrors the delete-account pattern exactly).
//   2. Custom content — pass `children` instead of `message` for forms,
//      lists, or anything more complex. You can still use the built-in
//      footer buttons, or pass `hideFooter` and render your own inside
//      children.
//
// Props:
//   open            boolean
//   onClose         () => void
//   icon            a lucide-react icon component, e.g. AlertCircle
//   accent          'danger' | 'default' | 'success' | 'warning' (default: 'default')
//   title           string
//   message         string — simple description text (optional)
//   children        ReactNode — custom body content instead of `message` (optional)
//   primaryLabel    string (optional — omit to hide the primary button)
//   onPrimary       () => void
//   primaryLoading  boolean — shows spinner + disables both buttons
//   primaryLoadingLabel string
//   secondaryLabel  string (default: 'Cancel')
//   onSecondary     () => void (defaults to onClose)
//   hideFooter      boolean — render your own buttons inside children instead
//   maxWidth        number (default: 440)

import React from 'react';

const ACCENTS = {
  danger:  { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', solid: '#dc2626', solidHover: '#fca5a5' },
  default: { bg: '#faf5ff', border: '#ede9fe', icon: '#7c3aed', solid: '#7c3aed', solidHover: '#c4b5fd' },
  success: { bg: '#ecfdf5', border: '#a7f3d0', icon: '#059669', solid: '#059669', solidHover: '#6ee7b7' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', solid: '#d97706', solidHover: '#fcd34d' },
};

// Self-contained styles: the Profile page's reference modal relies on
// ProfilePage.css for its fadeIn keyframes and .prof-spinner-sm class,
// neither of which exist outside that page. Scoping our own copies here
// means BrandModal looks/animates correctly on every page it's used on,
// not just Profile.
const STYLE_ID = 'brand-modal-styles';
function ensureStylesInjected() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes brandModalFadeIn {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .brand-modal-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: brandModalSpin 0.7s linear infinite;
    }
    @keyframes brandModalSpin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}


export default function BrandModal({
  open,
  onClose,
  icon: Icon,
  accent = 'default',
  title,
  message,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryLoadingLabel,
  secondaryLabel,
  onSecondary,
  hideFooter = false,
  maxWidth = 440,
}) {
  if (!open) return null;
  const c = ACCENTS[accent] || ACCENTS.default;
  ensureStylesInjected();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => !primaryLoading && onClose?.()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #ede9fe',
          boxShadow: '0 24px 60px rgba(124,58,237,0.18)',
          maxWidth,
          width: '100%',
          padding: '36px 32px',
          textAlign: 'center',
          animation: 'brandModalFadeIn 0.2s ease',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {Icon && (
          <div style={{
            width: 56, height: 56,
            background: c.bg,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            border: `1px solid ${c.border}`,
          }}>
            <Icon size={28} color={c.icon} />
          </div>
        )}

        {title && (
          <h2 style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: '1.5rem',
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#1a1a2e',
            margin: '0 0 12px',
          }}>
            {title}
          </h2>
        )}

        {message && (
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, margin: '0 0 28px' }}>
            {message}
          </p>
        )}

        {children && (
          <div style={{ textAlign: 'left', margin: title || message ? '0 0 24px' : 0 }}>
            {children}
          </div>
        )}

        {!hideFooter && (primaryLabel || secondaryLabel !== null) && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onSecondary || onClose}
              disabled={primaryLoading}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: 12,
                border: '1.5px solid #ede9fe',
                background: '#faf5ff',
                color: '#7c3aed',
                fontWeight: 600,
                fontSize: 14,
                cursor: primaryLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {secondaryLabel || 'Cancel'}
            </button>
            {primaryLabel && (
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryLoading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: primaryLoading ? c.solidHover : c.solid,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: primaryLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {primaryLoading
                  ? <><span className="brand-modal-spinner" /> {primaryLoadingLabel || 'Loading…'}</>
                  : primaryLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Shared input styling for use inside BrandModal children — matches the
// site's form fields elsewhere (purple focus ring, rounded corners).
export const brandInputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #ede9fe',
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#1a1a2e',
  outline: 'none',
  boxSizing: 'border-box',
};

export const brandLabelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};
