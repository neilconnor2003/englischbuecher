
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import config from '@/config';
import { Link } from 'react-router-dom';

function Series() {
  const { series_slug } = useParams();
  const navigate = useNavigate();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const seriesName = series_slug?.replace(/-/g, ' ');

  useEffect(() => {
    axios
      .get(`${config.API_URL}/api/series/${series_slug}`)
      .then(res => {
        setBooks(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(() => setBooks([]));
  }, [series_slug]);

  if (loading) return <div className="loading">Loading...</div>;

  if (books.length === 0) {
    return <div className="not-found">Series not found</div>;
  }

  const author = books[0]?.author;

  return (
    <div className="series-page container">

      <Helmet>
        <title>{seriesName} Books in Order | EnglischBuecher</title>
      </Helmet>

      <button onClick={() => navigate(-1)}>← Back</button>

      <h1>{seriesName}</h1>
      <p>by {author}</p>
      <p>{books.length} books</p>

      <div className="series-list">
        {books.map((book) => (
          <Link key={book.id} to={`/book/${book.id}`} className="series-item">
            <img src={book.image} alt={book.title_en} />

            <div>
              <h3>
                {book.series_volume}. {book.title_en}
              </h3>

              <p>€{book.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Series;
