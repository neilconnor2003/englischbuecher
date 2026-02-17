
// frontend/src/pages/AuthorDetails/AuthorDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import './AuthorDetails.css';
import BookCard from '../../components/Book/BookCard';
import { Helmet } from 'react-helmet-async';

/* === Initials Avatar helpers (local-only) === */
const colorFromString = (s = '') => {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
};
const initialsFromName = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AuthorDetails = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [author, setAuthor] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // normalize author.photo to absolute URL
  const toAbsolute = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${config.API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: authorData } = await axios.get(
          `${config.API_URL}/api/authors/slug/${slug}`
        );
        // ensure absolute image url
        const hydratedAuthor = { ...authorData, photo: toAbsolute(authorData.photo) };
        setAuthor(hydratedAuthor);

        const { data: booksData } = await axios.get(
          `${config.API_URL}/api/authors/${authorData.id}/books`
        );
        // normalize each book’s image to absolute (BookCard tolerates both, but consistent UX is nicer)
        const normalized = booksData.map(b => ({
          ...b,
          image: b.image?.startsWith('/uploads')
            ? `${config.API_URL}${b.image}`
            : b.image
        }));
        setBooks(normalized);
      } catch (err) {
        console.error('Author page load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (!author) return <div className="not-found">Author not found</div>;

  const avatar = (
    <div
      className="author-fallback-avatar"
      style={{ background: colorFromString(author.name) }}
      aria-label={author.name}
      title={author.name}
    >
      {initialsFromName(author.name)}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{author.name} – Author | Your Bookstore</title>
        <meta
          name="description"
          content={`Books and biography of ${author.name}. Browse all books by ${author.name}.`}
        />
        <link rel="canonical" href={`${window.location.origin}/author/${slug}`} />
        {author.photo && <meta property="og:image" content={author.photo} />}
      </Helmet>

      <div className="author-details-page">
        <div className="container">
          <button onClick={() => navigate(-1)} className="back-btn">← Back</button>

          {/* Header */}
          <header className="author-header">
            <div className="author-portrait">
              {/* Base layer: initials avatar */}
              {avatar}
              {/* Photo overlay */}
              {author.photo && (
                <img
                  src={author.photo}
                  alt={author.name}
                  className="author-photo-img"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>

            <div className="author-headline">
              <h1 className="author-name-title">{author.name}</h1>
              <p className="author-bio">{author.bio || 'No biography available.'}</p>
            </div>
          </header>

          {/* Books grid using central BookCard */}
          <section aria-labelledby="books-by-author">
            <h2 id="books-by-author" className="books-by-author-title">
              Books by {author.name}
            </h2>

            <div className="author-books-grid">
              {books.map((b) => (
                <BookCard key={b.id} book={b} variant="default" showActions={true} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default AuthorDetails;
