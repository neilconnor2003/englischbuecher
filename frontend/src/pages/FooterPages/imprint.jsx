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

  const hasVat = imp.tax_id && imp.tax_id.toUpperCase() !== 'NA';
  const hasTaxNumber = imp.tax_number && imp.tax_number.toUpperCase() !== 'NA';
  const hasRegister = imp.register_number && imp.register_number.toUpperCase() !== 'NA';

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>{t('imprint.title')}</h1>

        <p>
          <strong>{isDe ? imp.company_name_de : imp.company_name_en}</strong><br />
          {isDe ? 'Einzelunternehmen' : 'Sole Proprietorship'}
        </p>

        <p>
          {isDe ? imp.owner_name_de : imp.owner_name_en}<br />
          {isDe ? imp.address_street_de : imp.address_street_en}<br />
          {isDe ? imp.address_city_de : imp.address_city_en}<br />
          {isDe ? 'Deutschland' : 'Germany'}
        </p>

        <h2>{t('imprint.contact') || (isDe ? 'Kontakt' : 'Contact')}</h2>
        <p>
          {imp.phone && (
            <>{t('imprint.phone')}: <a href={`tel:${imp.phone}`}>{imp.phone}</a><br /></>
          )}
          {t('imprint.email')}: <a href={`mailto:${imp.email}`}>{imp.email}</a><br />
          {t('imprint.web')}: <a href={`https://${imp.website}`}>{imp.website}</a>
        </p>

        <h2>{t('imprint.tax')}</h2>
        <p>
          {hasVat && <>USt-IdNr.: {imp.tax_id}<br /></>}
          {hasTaxNumber && <>Steuernummer: {imp.tax_number}<br /></>}
          {!hasVat && (
            isDe
              ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).'
              : 'No VAT is charged in accordance with §19 of the German VAT Act (small business regulation).'
          )}
        </p>

        {hasRegister && (
          <>
            <h2>{t('imprint.register') || (isDe ? 'Gewerbeanmeldung' : 'Trade Registration')}</h2>
            <p>
              {isDe ? imp.register_court_de : imp.register_court_en}<br />
              {isDe ? 'Gewerbeanmeldenummer' : 'Trade registration number'}: {imp.register_number}
            </p>
          </>
        )}

        <h2>{t('imprint.responsible')}</h2>
        <p>{isDe ? imp.responsible_person_de : imp.responsible_person_en}</p>

        <h2>{t('imprint.disclaimer')}</h2>
        <div dangerouslySetInnerHTML={{ __html: isDe ? imp.disclaimer_de : imp.disclaimer_en }} />
      </div>
    </div>
  );
};

export default Imprint;
