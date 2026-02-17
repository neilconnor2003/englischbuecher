// frontend/src/pages/Contact.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetContactQuery } from '../../admin/features/contact/contactApiSlice';
import './Contact.css';

const Contact = () => {
  const { t } = useTranslation();
  const { data: contact = {}, isLoading: loadingContact } = useGetContactQuery();
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
      const res = await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (res.ok) {
        setStatus('success');
        e.target.reset();
      } else {
        setStatus('error');
        alert(json.error(json.error || 'Something went wrong'));
      }
    } catch (err) {
      setStatus('error');
      alert('Network error. Please try again.');
    }
  };

  if (loadingContact) return <div className="p-20 text-center">Loading...</div>;

  const heroImage = contact.hero_image_url || '/assets/contact-hero.jpg';

  return (
    <div className="contact-page">
      <div className="contact-hero" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.7)), url(${heroImage})` }}>
        <h1>{t('lang') === 'de' ? contact.title_de : contact.title_en || t('contact.title')}</h1>
        <p>{t('lang') === 'de' ? contact.subtitle_de : contact.subtitle_en || t('contact.subtitle')}</p>
      </div>

      <div className="contact-container">
        <div className="contact-grid">
          {/* === LEFT SIDE — INFO === */}
          <div className="contact-info">
            <h2>{t('contact.info.title')}</h2>
            <div className="info-item">
              <strong>{t('contact.info.email')}</strong>
              <a href={`mailto:${contact.email || 'support@dein-englisch-buecher.de'}`}>
                {contact.email || 'support@dein-englisch-buecher.de'}
              </a>
            </div>
            <div className="info-item">
              <strong>{t('contact.info.phone')}</strong>
              <a href={`tel:${contact.phone || '+498912345678'}`}>
                {contact.phone || '+49 89 12345678'}
              </a><br />
              <small>
                {t('lang') === 'de' ? contact.phone_hours_de : contact.phone_hours_en || 'Mo–Fr 9–17 Uhr'}
              </small>
            </div>
            <div className="info-item">
              <strong>{t('contact.info.response')}</strong>
              <p>
                {t('lang') === 'de' ? contact.response_time_de : contact.response_time_en || t('contact.info.response_text')}
              </p>
            </div>
          </div>

          {/* === RIGHT SIDE — FORM === */}
          <div className="contact-form">
            <h2>{t('contact.form.title')}</h2>
            <form onSubmit={handleSubmit}>
              <input type="text" name="name" placeholder={t('contact.form.name')} required />
              <input type="email" name="email" placeholder={t('contact.form.email')} required />
              <input type="text" name="subject" placeholder={t('contact.form.subject')} required />
              <textarea name="message" rows="6" placeholder={t('contact.form.message')} required></textarea>

              <button type="submit" className="submit-btn" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : t('contact.form.submit')}
              </button>

              {status === 'success' && <p style={{color:'green',marginTop:'1rem'}}>Message sent successfully!</p>}
              {status === 'error' && <p style={{color:'red',marginTop:'1rem'}}>Failed. Please try again.</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;