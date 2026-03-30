// src/pages/about.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetAboutQuery } from '../../admin/features/about/aboutApiSlice';
import './About.css';

const About = () => {
  const { t } = useTranslation();
  const { data: about = {}, isLoading } = useGetAboutQuery();

  if (isLoading) return <div className="p-20 text-center">Loading...</div>;

  return (
    <div className="about-page">
      <div className="about-hero" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.6)), url(${about.hero_image_url || '/assets/about-hero.jpg'})` }}>
        <div className="hero-content">
          <h1>{t('lang') === 'de' ? about.title_de : about.title_en || t('about.title')}</h1>
          <p className="subtitle">{t('lang') === 'de' ? about.subtitle_de : about.subtitle_en || t('about.subtitle')}</p>
        </div>
      </div>

      <div className="about-content">
        <section className="mission">
          <h2>{t('about.mission.title')}</h2>
          <p>{t('lang') === 'de' ? about.mission_de : about.mission_en}</p>
        </section>

        <section className="story">
          <div className="story-text">
            <h2>{t('about.story.title')}</h2>
            <p>{t('lang') === 'de' ? about.story_de : about.story_en}</p>
          </div>
          <div className="story-image">
            <img src={about.story_image_url || '/assets/about-bookstack.jpg'} alt="Our story" />
          </div>
        </section>

        <section className="values">
          <h2>{t('about.values.title')}</h2>
          <div className="values-grid">
            {['quality', 'service', 'speed'].map(key => (
              <div className="value-card" key={key}>
                <h3>{t('lang') === 'de' ? about[`values_${key}_de`] : about[`values_${key}_en`]}</h3>
                <p>{t('lang') === 'de' ? about[`values_${key}_text_de`] : about[`values_${key}_text_en`]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="team">
          <h2>{t('about.team.title')}</h2>
          <p>{t('lang') === 'de' ? about.team_de : about.team_en}</p>
        </section>
      </div>
    </div>
  );
};

export default About;