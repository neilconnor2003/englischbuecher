import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import './CategorySlider.css';

function CategorySlider() {
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios.get(`${config.API_URL}/api/categories`, { withCredentials: true })
      .then(res => setCategories(res.data || []))
      .catch(err => console.error('Error fetching categories:', err));
  }, []);

  return (
    <div className="category-slider">
      <h2>{t('categories')}</h2>
      <div className="slider">
        {categories.length > 0 ? (
          categories.map(category => (
            <Link
              key={category.id}
              to={`/category/${category.id}`}
              className="category-item"
            >
              {i18n.language === 'de' ? category.name_de || category.name_en : category.name_en}
            </Link>
          ))
        ) : (
          <p>{t('no_categories')}</p>
        )}
      </div>
    </div>
  );
}

export default CategorySlider;