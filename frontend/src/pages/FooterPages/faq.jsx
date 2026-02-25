// frontend/src/pages/FAQ.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetFaqsQuery } from '../../admin/features/faq/faqApiSlice';
import './faq.css';

const FAQ = () => {
  const { t, i18n } = useTranslation();
  const { data: faqs = [], isLoading } = useGetFaqsQuery();
  const [openIndex, setOpenIndex] = useState(null);
  const lang = i18n.language;

  if (isLoading) return <div className="faq-page"><div className="faq-container p-20 text-center">Loading...</div></div>;

  return (
    <div className="faq-page">
      <div className="faq-hero">
        <h1>{t('faq.title')}</h1>
        <p>{t('faq.subtitle')}</p>
      </div>
      <div className="faq-container">
        {faqs.length === 0 ? (
          <p className="text-center text-gray-500 py-10">Noch keine FAQs vorhanden.</p>
        ) : (
          faqs.map((item, index) => (
            <div
              key={item.id}
              className={`faq-item ${openIndex === index ? 'open' : ''}`}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <div className="faq-question">
                <h3>{lang === 'de' ? item.question_de : item.question_en}</h3>
                <span className="faq-toggle">{openIndex === index ? '−' : '+'}</span>
              </div>
              <div className="faq-answer">
                <div dangerouslySetInnerHTML={{
                  __html: lang === 'de' ? item.answer_de : item.answer_en
                }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FAQ;