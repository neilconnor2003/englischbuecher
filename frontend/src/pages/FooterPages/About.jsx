
// src/pages/About.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetAboutQuery } from '../../admin/features/about/aboutApiSlice';
import './About.css';

const About = () => {
  const { t, i18n } = useTranslation();
  const { data: about = {}, isLoading } = useGetAboutQuery();

  if (isLoading) return <div style={{ padding: 80, textAlign: 'center' }}>Loading...</div>;

  const lang = i18n.language;

  const title =
    lang === 'de'
      ? (about.title_de || t('about.title'))
      : (about.title_en || t('about.title'));

  const subtitle =
    lang === 'de'
      ? (about.subtitle_de || t('about.subtitle'))
      : (about.subtitle_en || t('about.subtitle'));

  const mission = lang === 'de' ? about.mission_de : about.mission_en;
  const story = lang === 'de' ? about.story_de : about.story_en;
  const teamText = lang === 'de' ? about.team_de : about.team_en;

  const heroImage = about.hero_image_url || '/assets/about-hero.jpg';
  const storyImage = about.story_image_url || '/assets/about-story.jpg';

  const values = ['quality', 'service', 'speed'].map((key) => ({
    title: lang === 'de' ? about[`values_${key}_de`] : about[`values_${key}_en`],
    text: lang === 'de' ? about[`values_${key}_text_de`] : about[`values_${key}_text_en`],
  }));

  return (
    <div className="about-page">
      {/* HERO */}
      <div
        className="about-hero"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('${heroImage}')`,
        }}
      >
        <div className="hero-content">
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="about-content">
        {/* MISSION */}
        <section className="mission">
          <h2>{t('about.mission.title')}</h2>
          <p>
            {mission ||
              (lang === 'de'
                ? 'Wir machen englische Bücher in Deutschland einfach zugänglich – sorgfältig ausgewählt, schnell geliefert und mit viel Liebe zum Lesen.'
                : 'We make English books easy to access in Germany — carefully curated, fast delivered, and built with a genuine love for reading.')}
          </p>
        </section>

        {/* STORY */}
        <section className="story">
          <div className="story-text">
            <h2>{t('about.story.title')}</h2>
            <p style={{ color: '#475569', lineHeight: 1.8, fontSize: 18 }}>
              {story ||
                (lang === 'de'
                  ? 'Dein Englisch Bücher entstand aus einer einfachen Idee: großartige englische Bücher sollen ohne Aufwand zu dir kommen. Wir kombinieren eine sorgfältige Auswahl, transparente Infos und zuverlässigen Versand – damit du mehr Zeit zum Lesen hast.'
                  : 'Dein Englisch Bücher began with a simple idea: getting great English books should be effortless. We combine thoughtful selection, clear information, and reliable shipping — so you can spend more time reading.')}
            </p>

            <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
              <div
                style={{
                  background: '#fff',
                  padding: 14,
                  borderRadius: 12,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                }}
              >
                <strong style={{ color: '#5b21b6' }}>
                  {lang === 'de' ? 'Schneller Versand' : 'Fast shipping'}
                </strong>
                <div style={{ color: '#475569', marginTop: 6 }}>
                  {lang === 'de'
                    ? 'Deutschland: 3,99 € • ab 29 € versandkostenfrei'
                    : 'Germany: €3.99 • free shipping from €29'}
                </div>
              </div>

              <div
                style={{
                  background: '#fff',
                  padding: 14,
                  borderRadius: 12,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                }}
              >
                <strong style={{ color: '#5b21b6' }}>
                  {lang === 'de' ? 'Einfache Rückgabe' : 'Easy returns'}
                </strong>
                <div style={{ color: '#475569', marginTop: 6 }}>
                  {lang === 'de'
                    ? 'Klare Schritte, schnelle Abwicklung, fairer Support.'
                    : 'Clear steps, quick handling, and fair support.'}
                </div>
              </div>
            </div>
          </div>

          <div className="story-image">
            <img src={storyImage} alt="About story" />
          </div>
        </section>

        {/* VALUES */}
        <section className="values">
          <h2>{t('about.values.title')}</h2>
          <div className="values-grid">
            {values.map((v, idx) => (
              <div className="value-card" key={idx}>
                <h3>
                  {v.title ||
                    (lang === 'de'
                      ? ['Qualität', 'Service', 'Tempo'][idx]
                      : ['Quality', 'Service', 'Speed'][idx])}
                </h3>
                <p style={{ color: '#475569', lineHeight: 1.7, fontSize: 17 }}>
                  {v.text ||
                    (lang === 'de'
                      ? [
                          'Wir wählen Titel sorgfältig aus – Klassiker, Bestseller und neue Entdeckungen.',
                          'Du bekommst schnelle Hilfe per E‑Mail und klare Antworten.',
                          'Wir liefern zuverlässig, damit dein nächstes Buch nicht lange wartet.',
                        ][idx]
                      : [
                          'We curate carefully — classics, bestsellers, and fresh discoveries.',
                          'You get fast help via email and clear answers.',
                          'Reliable delivery so your next book doesn’t take forever to arrive.',
                        ][idx])}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* TEAM */}
        <section className="team">
          <h2>{t('about.team.title')}</h2>
          <p style={{ maxWidth: 850, margin: '0 auto', fontSize: 18, color: '#1e293b', lineHeight: 1.8 }}>
            {teamText ||
              (lang === 'de'
                ? 'Wir sind ein kleines Team mit großer Liebe zu englischen Büchern. Du hast Wünsche, Feedback oder suchst ein bestimmtes Buch? Schreib uns — wir helfen gern.'
                : 'We’re a small team with a big love for English books. Have a request, feedback, or looking for a specific title? Message us — happy to help.')}
          </p>

          <div className="team-contact" style={{ marginTop: 18 }}>
            <Link
              to="/contact"
              style={{
                display: 'inline-block',
                background: '#7c3aed',
                color: '#fff',
                padding: '12px 22px',
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {lang === 'de' ? 'Kontakt aufnehmen' : 'Contact us'}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
