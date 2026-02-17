// frontend/src/pages/Imprint.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetImprintQuery } from '../../admin/features/imprint/imprintApiSlice';
import './Legal.css';

const Imprint = () => {
  const { t, i18n } = useTranslation();
  const { data: imp = {}, isLoading } = useGetImprintQuery();
  const lang = i18n.language;

  if (isLoading) return <div className="legal-page"><div className="legal-container p-20 text-center">Loading...</div></div>;

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>{t('imprint.title')}</h1>
        
        <p><strong>{lang === 'de' ? imp.company_name_de : imp.company_name_en || 'Dein Englisch Bücher'}</strong></p>
        
        <p>
          {lang === 'de' ? imp.owner_name_de : imp.owner_name_en || 'Max Mustermann'}<br />
          {lang === 'de' ? imp.address_street_de : imp.address_street_en || 'Musterstraße 123'}<br />
          {lang === 'de' ? imp.address_city_de : imp.address_city_en || '80331 München'}<br />
          Deutschland
        </p>

        <p>
          {t('imprint.phone')}: <a href={`tel:${imp.phone || '+498912345678'}`}>{imp.phone || '+49 89 12345678'}</a><br />
          {t('imprint.email')}: <a href={`mailto:${imp.email || 'info@dein-englisch-buecher.de'}`}>{imp.email || 'info@dein-englisch-buecher.de'}</a><br />
          {t('imprint.web')}: <a href={`https://${imp.website || 'dein-englisch-buecher.de'}`}>{imp.website || 'dein-englisch-buecher.de'}</a>
        </p>

        <h2>{t('imprint.tax')}</h2>
        <p>
          USt-IdNr.: {imp.tax_id || 'DE123456789'}<br />
          Steuernummer: {imp.tax_number || '123/456/78901'}
        </p>

        <h2>{t('imprint.register')}</h2>
        <p>
          {lang === 'de' ? imp.register_court_de : imp.register_court_en || 'Amtsgericht München'}<br />
          Registernummer: {imp.register_number || 'HRB 123456'}
        </p>

        <h2>{t('imprint.responsible')}</h2>
        <p>
          {lang === 'de' ? imp.responsible_person_de : imp.responsible_person_en || 'Max Mustermann, Musterstraße 123, 80331 München'}
        </p>

        <h2>{t('imprint.disclaimer')}</h2>
        <p>{lang === 'de' ? imp.disclaimer_de : imp.disclaimer_en || t('imprint.disclaimer_text')}</p>
      </div>
    </div>
  );
};

export default Imprint;