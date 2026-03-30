// src/pages/about.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetAboutQuery } from '../../admin/features/about/aboutApiSlice';
import './About.css';


const API_BASE_URL = import.meta.env.VITE_API_URL;

const About = () => {
  //const { t } = useTranslation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data: about = {}, isLoading } = useGetAboutQuery();


  const rawHero = about.hero_image_url || '';
  const heroImage = rawHero
    ? (rawHero.startsWith('http') ? rawHero : `${API_BASE_URL}${rawHero}`)
    : '';


  const rawStory = about.story_image_url || '';
  const storyImage = rawStory
    ? (rawStory.startsWith('http') ? rawStory : `${API_BASE_URL}${rawStory}`)
    : '/assets/about-bookstack.jpg';

  if (isLoading) return <div className="p-20 text-center">Loading...</div>;

  return (
    <div className="about-page">
      <div className="about-hero" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.6)), url(${heroImage || '/assets/about-hero.jpg'})` }}>
        <div className="hero-content">
          <h1>{lang === 'de' ? about.title_de : about.title_en || t('about.title')}</h1>
          <p className="subtitle">{lang === 'de' ? about.subtitle_de : about.subtitle_en || t('about.subtitle')}</p>
        </div>
      </div>

      <div className="about-content about-container">
        <section className="mission">
          <h2 className="about-section-title">
            {t('about.mission.title')}
          </h2>
          <p className="about-text">
            {t('lang') === 'de' ? about.mission_de : about.mission_en}
          </p>
        </section>
        <section className="story">
          <div className="story-text">
            <h2 className="about-section-title">
              {t('about.story.title')}
            </h2>
            <p className="about-text">
              {t('lang') === 'de' ? about.story_de : about.story_en}
            </p>
          </div>
          <div className="story-image">
            <img src={storyImage || '/assets/about-bookstack.jpg'} alt="Our story" />
          </div>
        </section>

        <section className="values">
          <h2>{t('about.values.title')}</h2>
          <div className="values-grid">
            {['quality', 'service', 'speed'].map(key => (
              <div className="value-card" key={key}>
                <h3>{lang === 'de' ? about[`values_${key}_de`] : about[`values_${key}_en`]}</h3>
                <p>{lang === 'de' ? about[`values_${key}_text_de`] : about[`values_${key}_text_en`]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="team">
          <h2 className="about-section-title">
            {t('about.team.title')}
          </h2>
          <p className="about-text">
            {t('lang') === 'de' ? about.team_de : about.team_en}
          </p>
        </section>
      </div>
    </div>
  );
};

export default About;