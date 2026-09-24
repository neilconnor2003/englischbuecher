// frontend/src/pages/GiftLists/ShareListModal.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Copy, Mail, MessageCircle } from 'lucide-react';
import BrandModal from '../../components/common/BrandModal';
import { toast } from 'react-toastify';

export default function ShareListModal({ open, onClose, url, title }) {
  const { t } = useTranslation();
  const shareText = title
    ? (t('share_list_text', { title }) || `Check out my gift list: ${title}`)
    : (t('share_list_text_generic') || 'Check out my gift list');

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success(t('link_copied') || 'Link copied!');
  };

  return (
    <BrandModal
      open={open}
      onClose={onClose}
      icon={Share2}
      accent="default"
      title={t('share_list') || 'Share this list'}
      hideFooter
    >
      <div className="gl-share-options">
        {canNativeShare && (
          <button
            type="button"
            className="gl-share-option"
            onClick={() => navigator.share({ title, text: shareText, url }).catch(() => {})}
          >
            <Share2 size={17} /> {t('share_via') || 'Share via...'}
          </button>
        )}

        <a
          className="gl-share-option"
          href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={17} /> WhatsApp
        </a>

        <a
          className="gl-share-option"
          href={`mailto:?subject=${encodeURIComponent(title || '')}&body=${encodeURIComponent(shareText + '\n\n' + url)}`}
        >
          <Mail size={17} /> {t('email') || 'Email'}
        </a>

        <button type="button" className="gl-share-option" onClick={copyLink}>
          <Copy size={17} /> {t('copy_link') || 'Copy Link'}
        </button>
      </div>

      <div className="gl-share-url-box">{url}</div>
    </BrandModal>
  );
}
