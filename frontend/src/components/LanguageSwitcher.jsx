// frontend/src/components/LanguageSwitcher.jsx
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from 'antd';
import './LanguageSwitcher.css';

const { Option } = Select;

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  // This forces the flag to update instantly when language changes
  useEffect(() => {
    const handleChange = () => {};
    i18n.on('languageChanged', handleChange);
    return () => i18n.off('languageChanged', handleChange);
  }, [i18n]);

  const handleChange = (value) => {
    i18n.changeLanguage(value);
    localStorage.setItem('i18nextLng', value);
  };

  return (
    <Select
      value={i18n.language.slice(0, 2)}
      onChange={handleChange}
      style={{ width: 64, height: 36 }}
      className="language-select custom-language-select"
      getPopupContainer={(trigger) => trigger.parentNode}
    >
      <Option value="en">
        <div className="flag-wrapper">
          <img src="/flags/us.png" alt="English" className="flag-icon" />
        </div>
      </Option>
      <Option value="de">
        <div className="flag-wrapper">
          <img src="/flags/de.png" alt="Deutsch" className="flag-icon" />
        </div>
      </Option>
    </Select>
  );
};

export default LanguageSwitcher;