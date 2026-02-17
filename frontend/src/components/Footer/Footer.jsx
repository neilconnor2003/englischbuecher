import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Footer.css';

function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/">
            <img src="/assets/logo.png" alt="Bookstore" className="logo-img" />
          </Link>
          <p>{t('footer.tagline')}</p>
        </div>

        <div className="footer-column">
          <h4>{t('footer.company')}</h4>
          <ul>
            <li><Link to="/about">{t('footer.about')}</Link></li>
            <li><Link to="/contact">{t('footer.contact')}</Link></li>
            <li><Link to="/imprint">{t('footer.imprint')}</Link></li>
          </ul>
        </div>

        <div className="footer-column">
          <h4>{t('footer.legal')}</h4>
          <ul>
            <li><Link to="/privacy">{t('footer.privacy')}</Link></li>
            <li><Link to="/terms">{t('footer.terms')}</Link></li>
            <li><Link to="/revocation">{t('footer.revocation')}</Link></li>
            <li><Link to="/shipping">{t('footer.shipping')}</Link></li>
          </ul>
        </div>

        <div className="footer-column">
          <h4>{t('footer.support')}</h4>
          <ul>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/returns">{t('footer.returns')}</Link></li>
            <li><a href="mailto:support@dein-englisch-buecher.de">support@dein-englisch-buecher.de</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {currentYear} Dein Englisch Bücher • All rights reserved.</p>
        <div className="footer-payment">
          <img src="/assets/payments/paypal.svg" alt="PayPal" />
          <img src="/assets/payments/visa.svg" alt="Visa" />
          <img src="/assets/payments/mastercard.svg" alt="Mastercard" />
          <img src="/assets/payments/apple-pay.svg" alt="Apple Pay" />
          <img src="/assets/payments/klarna.svg" alt="Klarna" />
        </div>
      </div>
    </footer>
  );
}

export default Footer;