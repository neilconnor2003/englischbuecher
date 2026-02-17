
// frontend/src/components/BooksSlider/BooksSlider.jsx
import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import BookCard from '../Book/BookCard';

export default function BooksSlider({ books, variant = 'default', className = '', onItemClick }) {
  return (
    <Swiper
      modules={[Navigation, Pagination]}
      spaceBetween={30}
      slidesPerView={2}
      navigation
      pagination={{ clickable: true }}
      loop={false}
      watchOverflow
      breakpoints={{
        640: { slidesPerView: 3, spaceBetween: 20 },
        768: { slidesPerView: 4, spaceBetween: 24 },
        1024: { slidesPerView: 4.1, spaceBetween: 30 },
        1280: { slidesPerView: 4.1, spaceBetween: 30 },
      }}
      className={className}
    >
      {books.map(b => (
        <SwiperSlide key={b.id}>
          <div className="popular-card-wrapper">
            <BookCard book={b} variant={variant} showActions onClick={() => onItemClick?.(b)} />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}