
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Layers,
    BookOpen,
    Calendar,
    User,
    CheckCircle2,
    Sparkles
} from 'lucide-react';

import config from '../../config';
import BooksSlider from '../../components/BooksSlider/BooksSlider';
import { generateBookUrl } from '../../utils/seoUrl';
import './Series.css';
import BookCard from '../../components/Book/BookCard';

function Series() {
    const { series_slug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const isDE = i18n.resolvedLanguage === 'de';


    const [books, setBooks] = useState([]);
    const [seriesAuthors, setSeriesAuthors] = useState([]);
    const [seriesDetailBook, setSeriesDetailBook] = useState(null);
    const [genreBooks, setGenreBooks] = useState([]);
    const [loading, setLoading] = useState(true);


    const currentBookId = location.state?.currentBookId || null;
    const currentSeriesVolume = location.state?.currentSeriesVolume || null;
    const fromBookTitle = location.state?.fromBookTitle || null;

    const prettySeriesName = String(series_slug || '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizeSeries = (value = '') =>
        String(value)
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();

    const parseSeriesVolume = (value) => {
        if (value === null || value === undefined) return Number.MAX_SAFE_INTEGER;

        const str = String(value).trim();
        if (!str) return Number.MAX_SAFE_INTEGER;

        const direct = Number(str);
        if (Number.isFinite(direct)) return direct;

        const match = str.match(/(\d+(\.\d+)?)/);
        if (match) return Number(match[1]);

        return Number.MAX_SAFE_INTEGER;
    };

    const formatPrice = (value) => {
        const locale = isDE ? 'de-DE' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(value) || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString(
                isDE ? 'de-DE' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
            );
        } catch {
            return '—';
        }
    };

    const sortedBooks = useMemo(() => {
        const arr = [...books];

        arr.sort((a, b) => {
            const volA = parseSeriesVolume(a.series_volume);
            const volB = parseSeriesVolume(b.series_volume);

            if (volA !== volB) return volA - volB;

            const dateA = new Date(a.publish_date || 0).getTime();
            const dateB = new Date(b.publish_date || 0).getTime();

            if (dateA !== dateB) return dateA - dateB;

            return String(a.title_en || '').localeCompare(String(b.title_en || ''));
        });

        return arr;
    }, [books]);

    const startBook = sortedBooks[0] || null;

    useEffect(() => {
        let cancelled = false;

        const fetchSeriesPage = async () => {
            setLoading(true);

            try {

                const seriesRes = await axios.get(`${config.API_URL}/api/series/${series_slug}`);
                const payload = seriesRes.data || {};
                const seriesBooks = Array.isArray(payload.books) ? payload.books : [];
                const allSeriesAuthors = Array.isArray(payload.authors) ? payload.authors : [];


                if (cancelled) return;


                setBooks(seriesBooks);
                setSeriesAuthors(allSeriesAuthors);


                if (seriesBooks.length > 0) {
                    // Fetch one full book detail to get authors + category_id + richer metadata
                    const detailRes = await axios.get(`${config.API_URL}/api/books/${seriesBooks[0].id}`);

                    if (cancelled) return;

                    //setSeriesDetailBook(detailRes.data || null);

                    setSeriesDetailBook({
                        ...(detailRes.data || {}),
                        authors: allSeriesAuthors.length > 0 ? allSeriesAuthors : (detailRes.data?.authors || [])
                    });


                    const categoryId = detailRes.data?.category_id;

                    if (categoryId) {
                        try {
                            //const genreRes = await axios.get(`${config.API_URL}/api/books/category/${categoryId}`);

                            const genreRes = await axios.get(
                                `${config.API_URL}/api/books/category/${categoryId}`,
                                {
                                    params: {
                                        excludeSeries: seriesBooks[0].series_name
                                    }
                                }
                            );

                            if (!cancelled) {
                                const rawGenreBooks = Array.isArray(genreRes.data) ? genreRes.data : [];

                                const filteredGenreBooks = rawGenreBooks.filter((b) => {
                                    const sameSeries =
                                        normalizeSeries(b.series_name || '') ===
                                        normalizeSeries(seriesBooks[0].series_name || '');

                                    const alreadyInCurrentSeries = seriesBooks.some((sb) => Number(sb.id) === Number(b.id));

                                    return !sameSeries && !alreadyInCurrentSeries;
                                });

                                setGenreBooks(filteredGenreBooks.slice(0, 12));
                            }
                        } catch {
                            if (!cancelled) setGenreBooks([]);
                        }
                    } else {
                        setGenreBooks([]);
                    }
                } else {

                    setSeriesDetailBook(null);
                    setSeriesAuthors([]);
                    setGenreBooks([]);

                }
            } catch (err) {
                console.error('Failed to load series page:', err);
                if (!cancelled) {

                    setBooks([]);
                    setSeriesAuthors([]);
                    setSeriesDetailBook(null);
                    setGenreBooks([]);

                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchSeriesPage();

        return () => {
            cancelled = true;
        };
    }, [series_slug]);

    if (loading) {
        return <div className="series-loading">Loading...</div>;
    }

    if (sortedBooks.length === 0) {
        return (
            <div className="series-page">
                <div className="container">
                    <button onClick={() => navigate(-1)} className="series-back-btn">
                        <ArrowLeft size={18} /> {t('back')}
                    </button>

                    <div className="series-empty-card">
                        <h1>{isDE ? 'Serie nicht gefunden' : 'Series not found'}</h1>
                        <p>
                            {isDE
                                ? 'Für diese Serie konnten keine Bücher gefunden werden.'
                                : 'No books were found for this series.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const displaySeriesName =
        seriesDetailBook?.series_name || prettySeriesName;


    const authorNames =
        seriesAuthors.length > 0
            ? seriesAuthors.map(a => a.name).join(', ')
            : (seriesDetailBook?.author || '');


    const seoTitle = `${displaySeriesName} ${isDE ? 'Reihenfolge' : 'Books in Order'} | EnglischBuecher`;

    const seoDescription = isDE
        ? `Alle verfügbaren Bücher der Reihe ${displaySeriesName} in richtiger Reihenfolge. Englische Bücher günstig in Deutschland kaufen.`
        : `Browse all available books in the ${displaySeriesName} series in reading order. Buy affordable English books in Germany.`;

    return (
        <>
            <Helmet>
                <title>{seoTitle}</title>
                <meta name="description" content={seoDescription} />
                <link rel="canonical" href={`https://englischbuecher.de/series/${series_slug}`} />

                {/* Open Graph */}
                <meta property="og:type" content="book.series" />
                <meta property="og:title" content={seoTitle} />
                <meta property="og:description" content={seoDescription} />
                <meta property="og:url" content={`https://englischbuecher.de/series/${series_slug}`} />
                <meta property="og:site_name" content="EnglischBuecher" />
                {series.cover_image && <meta property="og:image" content={series.cover_image} />}

                {/* BookSeries structured data */}
                <script type="application/ld+json">
                  {JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'BookSeries',
                    name: isDE ? (series.name_de || series.name_en) : series.name_en,
                    description: seoDescription,
                    url: `https://englischbuecher.de/series/${series_slug}`,
                    numberOfItems: books?.length || 0,
                  })}
                </script>
            </Helmet>

            <div className="series-page">
                <div className="container">
                    <button onClick={() => navigate(-1)} className="series-back-btn">
                        <ArrowLeft size={18} /> {t('back')}
                    </button>

                    {/* HERO */}
                    <section className="series-hero">
                        <div className="series-kicker">
                            <Layers size={16} />
                            <span>{isDE ? 'Reihe' : 'Series'}</span>
                        </div>

                        <h1 className="series-title">{displaySeriesName}</h1>

                        {authorNames && (
                            <p className="series-author-line">
                                <User size={16} />
                                <span>{isDE ? 'von' : 'by'} {authorNames}</span>
                            </p>
                        )}

                        <div className="series-meta-chips">
                            <span className="series-chip">
                                {sortedBooks.length} {isDE ? 'Bücher' : 'books'}
                            </span>

                            <span className="series-chip">
                                {isDE ? 'Englische Bücher' : 'English books'}
                            </span>

                            <span className="series-chip">
                                {isDE ? 'Versand in Deutschland' : 'Shipping in Germany'}
                            </span>
                        </div>

                        <p className="series-subtitle">
                            {isDE
                                ? `Entdecke alle verfügbaren Bücher aus der Reihe ${displaySeriesName} in der richtigen Lesereihenfolge.`
                                : `Discover all available books in the ${displaySeriesName} series in the correct reading order.`}
                        </p>

                        <div className="series-hero-actions">
                            {startBook && (
                                <Link to={generateBookUrl(startBook)} className="series-primary-btn">
                                    <BookOpen size={18} />
                                    {isDE ? 'Mit Buch 1 starten' : 'Start with Book 1'}
                                </Link>
                            )}

                            {currentBookId && (
                                <Link to={`/book/${currentBookId}`} className="series-secondary-btn">
                                    {isDE ? 'Zurück zum aktuellen Buch' : 'Back to current book'}
                                </Link>
                            )}
                        </div>

                        {currentBookId && currentSeriesVolume && (
                            <div className="series-current-note">
                                <Sparkles size={16} />
                                <span>
                                    {isDE
                                        ? `Du kommst von Band ${currentSeriesVolume}${fromBookTitle ? `: ${fromBookTitle}` : ''}`
                                        : `You came here from Book ${currentSeriesVolume}${fromBookTitle ? `: ${fromBookTitle}` : ''}`}
                                </span>
                            </div>
                        )}
                    </section>


                    {/* AUTHOR BIO */}
                    {seriesAuthors.length > 0 && (
                        <section className="series-author-section">
                            <h2 className="series-section-title">
                                {isDE ? 'Über die Autoren' : 'About the author(s)'}
                            </h2>

                            <div className="series-author-grid">
                                {seriesAuthors.map((author) => (
                                    <div key={author.id} className="series-author-card">
                                        <div className="series-author-photo-wrap">
                                            {author.photo ? (
                                                <img
                                                    src={author.photo}
                                                    alt={author.name}
                                                    className="series-author-photo"
                                                />
                                            ) : (
                                                <div className="series-author-photo placeholder">
                                                    {author.name?.slice(0, 1)?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                        </div>

                                        <div className="series-author-text">
                                            <h3>{author.name}</h3>
                                            <p>
                                                {isDE
                                                    ? (author.bio_de || author.bio || 'Keine Biografie verfügbar.')
                                                    : (author.bio || author.bio_de || 'No biography available.')}
                                            </p>

                                            {author.slug && (
                                                <Link to={`/author/${author.slug}`} className="series-inline-link">
                                                    {isDE ? 'Autorenseite ansehen' : 'View author page'}
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* SEO BLOCK */}
                    <section className="series-seo-section">
                        <div className="series-seo-card">
                            {/*<h2 className="series-section-title small">*/}
                            <h2 className="series-section-title">
                                {isDE
                                    ? `${displaySeriesName} Reihenfolge`
                                    : `${displaySeriesName} reading order`}
                            </h2>

                            <p>
                                {isDE
                                    ? `Auf dieser Seite findest du alle aktuell verfügbaren Bücher der Reihe ${displaySeriesName} in der richtigen Reihenfolge. Starte mit Band 1 oder springe direkt zu dem Band, den du gerade brauchst.`
                                    : `This page shows all currently available books in the ${displaySeriesName} series in the correct order. Start with Book 1 or jump directly to the volume you need.`}
                            </p>
                        </div>
                    </section>

                    {/* TIMELINE */}
                    <section className="series-timeline-section">
                        {/*<h2 className="series-section-title">
                            {isDE ? 'Lesereihenfolge' : 'Reading order'}
                        </h2>
                        <p>
                            {isDE
                                ? `Auf dieser Seite findest du alle aktuell verfügbaren Bücher der Reihe ${displaySeriesName} in der richtigen Reihenfolge. Starte mit Band 1 oder springe direkt zu dem Band, den du gerade brauchst.`
                                : `This page shows all currently available books in the ${displaySeriesName} series in the correct order. Start with Book 1 or jump directly to the volume you need.`}
                        </p>*/}

                        <div className="series-timeline">
                            {sortedBooks.map((book, index) => {
                                const isCurrent = currentBookId && Number(book.id) === Number(currentBookId);
                                const isFirst = index === 0;

                                return (
                                    <div
                                        key={book.id}
                                        className={`series-timeline-item ${isCurrent ? 'current' : ''}`}
                                    >
                                        <div className="series-timeline-node">
                                            <span>{index + 1}</span>
                                        </div>

                                        <div className="series-timeline-card">
                                            <div className="series-volume-badges">
                                                {book.series_volume && (
                                                    <span className="volume-badge">
                                                        {isDE ? 'Band' : 'Book'} {book.series_volume}
                                                    </span>
                                                )}

                                                {isFirst && (
                                                    <span className="starter-badge">
                                                        {isDE ? 'Start hier' : 'Start here'}
                                                    </span>
                                                )}

                                                {isCurrent && (
                                                    <span className="current-badge">
                                                        {isDE ? 'Du bist hier' : 'You are here'}
                                                    </span>
                                                )}
                                            </div>

                                            {/*<div className="series-book-grid}">

                                                <div className="series-book-cover-wrap">
                                                    <img
                                                        src={book.image || '/book-placeholder.png'}
                                                        alt={book.title_en || 'Book'}
                                                        className="series-book-cover"
                                                    />
                                                </div>


                                                <div className="series-book-main">
                                                    <h3 className="series-book-title">
                                                        {isDE ? (book.title_de || book.title_en) : book.title_en}
                                                    </h3>

                                                    <div className="series-book-meta">
                                                        <span>
                                                            <Calendar size={14} />
                                                            {formatDate(book.publish_date)}
                                                        </span>
                                                        {book.publisher && <span>{book.publisher}</span>}
                                                    </div>

                                                    <div className="series-book-price-row">
                                                        <span className="series-book-price">
                                                            {formatPrice(book.price)}
                                                        </span>

                                                        {book.original_price && Number(book.original_price) > Number(book.price) && (
                                                            <span className="series-book-list-price">
                                                                {formatPrice(book.original_price)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className={`series-book-stock ${book.stock > 0 ? 'in' : 'out'}`}>
                                                        {book.stock > 0 ? (
                                                            <>
                                                                <CheckCircle2 size={16} />
                                                                <span>
                                                                    {book.stock > 10
                                                                        ? (isDE ? 'Auf Lager' : 'In stock')
                                                                        : (isDE ? `Nur noch ${book.stock}` : `Only ${book.stock} left`)}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span>{isDE ? 'Nicht auf Lager' : 'Out of stock'}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="series-book-action">
                                                    <Link to={generateBookUrl(book)} className="series-view-btn">
                                                        {isDE ? 'Buch ansehen' : 'View book'}
                                                    </Link>
                                                </div>
                                            </div>*/}

                                            <div className="series-book-grid">

                                                <div className="series-book-cover-wrap">
                                                    <img
                                                        src={book.image || '/book-placeholder.png'}
                                                        alt={book.title_en || 'Book'}
                                                        className="series-book-cover"
                                                    />
                                                </div>

                                                <div className="series-book-main">
                                                    <h3 className="series-book-title">
                                                        {isDE ? (book.title_de || book.title_en) : book.title_en}
                                                    </h3>

                                                    {authorNames && (
                                                        <div className="series-book-author">
                                                            {isDE ? 'von' : 'by'} {authorNames}
                                                        </div>
                                                    )}

                                                    <div className="series-book-meta">
                                                        {book.publish_date && (
                                                            <span><Calendar size={13} />{formatDate(book.publish_date)}</span>
                                                        )}
                                                        {book.publisher && <span>{book.publisher}</span>}
                                                        {book.format && <span>{book.format}</span>}
                                                    </div>

                                                    <div className="series-book-price-row">
                                                        <span className="series-book-price">
                                                            {formatPrice(book.price)}
                                                        </span>
                                                        {book.original_price && Number(book.original_price) > Number(book.price) && (
                                                            <span className="series-book-list-price">
                                                                {formatPrice(book.original_price)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className={`series-book-stock ${book.stock > 0 ? 'in' : 'out'}`}>
                                                        {book.stock > 0 ? (
                                                            <>
                                                                <CheckCircle2 size={14} />
                                                                <span>
                                                                    {book.stock > 10
                                                                        ? (isDE ? 'Auf Lager' : 'In stock')
                                                                        : (isDE ? `Nur noch ${book.stock} verfügbar` : `Only ${book.stock} left`)}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span>{isDE ? 'Nicht auf Lager' : 'Out of stock'}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="series-book-action">
                                                    <Link to={generateBookUrl(book)} className="series-view-btn">
                                                        {isDE ? 'Ansehen' : 'View'}
                                                    </Link>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>



                    {/* IN THIS GENRE */}
                    {genreBooks.length > 0 && (
                        <section className="series-genre-section">
                            <h2 className="series-section-title">
                                {isDE ? 'Auch in diesem Genre' : 'In this genre'}
                            </h2>

                            <BooksSlider
                                books={genreBooks}
                                variant="default"
                                className="home-swiper"
                            />
                        </section>
                    )}

                    {/* SEO BLOCK */}
                    <section className="series-seo-section">
                        <div className="series-seo-card">
                            <h2 className="series-section-title small">
                                {isDE
                                    ? `${displaySeriesName} Reihenfolge`
                                    : `${displaySeriesName} reading order`}
                            </h2>

                            <p>
                                {isDE
                                    ? `Auf dieser Seite findest du alle aktuell verfügbaren Bücher der Reihe ${displaySeriesName} in der richtigen Reihenfolge. Starte mit Band 1 oder springe direkt zu dem Band, den du gerade brauchst.`
                                    : `This page shows all currently available books in the ${displaySeriesName} series in the correct order. Start with Book 1 or jump directly to the volume you need.`}
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

export default Series;
