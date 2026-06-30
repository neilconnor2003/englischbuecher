// frontend/src/pages/Imprint.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetImprintQuery } from '../../admin/features/imprint/imprintApiSlice';
import './legal.css';

const Imprint = () => {
  const { t, i18n } = useTranslation();
  const { data: imp = {}, isLoading } = useGetImprintQuery();
  const lang = i18n.language;
  const isDe = lang === 'de';

  if (isLoading) return <div className="legal-page"><div className="legal-container p-20 text-center">Loading...</div></div>;

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>{t('imprint.title')}</h1>

        <p>
          <strong>{isDe ? (imp.company_name_de || 'EnglischBücher') : (imp.company_name_en || 'EnglischBücher')}</strong><br />
          {isDe ? 'Einzelunternehmen' : 'Sole Proprietorship'}
        </p>

        <p>
          {isDe ? (imp.owner_name_de || 'Shelly Biswal') : (imp.owner_name_en || 'Shelly Biswal')}<br />
          {isDe ? (imp.address_street_de || 'Im Schwalg 60') : (imp.address_street_en || 'Im Schwalg 60')}<br />
          {isDe ? (imp.address_city_de || '55411 Bingen') : (imp.address_city_en || '55411 Bingen')}<br />
          {isDe ? 'Deutschland' : 'Germany'}
        </p>

        <h2>{t('imprint.contact') || (isDe ? 'Kontakt' : 'Contact')}</h2>
        <p>
          {imp.phone && (
            <>{t('imprint.phone')}: <a href={`tel:${imp.phone}`}>{imp.phone}</a><br /></>
          )}
          {t('imprint.email')}: <a href={`mailto:${imp.email || 'admin@englischbuecher.de'}`}>{imp.email || 'admin@englischbuecher.de'}</a><br />
          {t('imprint.web')}: <a href={`https://${imp.website || 'englischbuecher.de'}`}>{imp.website || 'englischbuecher.de'}</a>
        </p>

        <h2>{t('imprint.tax')}</h2>
        <p>
          {imp.tax_number
            ? <>Steuernummer: {imp.tax_number}<br /></>
            : <span style={{ color: '#9ca3af' }}>{isDe ? '08/511/12298' : '08/511/12298'}<br /></span>
          }
          {isDe
            ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).'
            : 'No VAT is charged in accordance with §19 of the German VAT Act (small business regulation).'}
        </p>

        <h2>{t('imprint.responsible')}</h2>
        <p>
          {isDe
            ? (imp.responsible_person_de || 'Shelly Biswal, Im Schwalg 60, 55411 Bingen')
            : (imp.responsible_person_en || 'Shelly Biswal, Im Schwalg 60, 55411 Bingen, Germany')}
        </p>

        <h2>{t('imprint.disclaimer')}</h2>
        <p>{isDe ? (imp.disclaimer_de || t('imprint.disclaimer_text')) : (imp.disclaimer_en || t('imprint.disclaimer_text'))}</p>
      </div>
    </div>
  );
};

export default Imprint;
