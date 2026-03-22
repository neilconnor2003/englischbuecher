
// frontend/src/components/BooksSlider/BooksSlider.jsx
import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';            // 👈 dots only (no arrows)
import 'swiper/css';
import 'swiper/css/pagination';

import BookCard from '../Book/BookCard';

export default function BooksSlider({
  books = [],
  variant = 'default',
  className = 'home-swiper',                            // 👈 default to unified class
  onItemClick,
}) {
  return (
    <Swiper
      className={className}
      slidesPerView="auto"                               // 👈 device‑agnostic: 1 full card + peek
      spaceBetween={12}                                  // 👈 matches our Home.css spacing
      pagination={{ clickable: true }}
      modules={[Pagination]}
    >
      {books.map((b) => (
        <SwiperSlide key={b.id}>
          <div className="popular-card-wrapper">         {/* 👈 enforces the 260px cap cleanly */}
            <BookCard
              book={b}
              variant={variant}
              onClick={() => onItemClick?.(b)}
            />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
