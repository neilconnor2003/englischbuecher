
// src/components/CategoryMenu/CategoryMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetCategoriesQuery } from '../../admin/features/book/bookApiSlice';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './CategoryMenu.css';

function CategoryMenu() {
  const { t, i18n } = useTranslation();
  const [hoveredId, setHoveredId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  const { data = { hierarchy: [] }, isLoading } = useGetCategoriesQuery();
  const allRoots = Array.isArray(data.hierarchy) ? data.hierarchy : [];

  // Filter visible roots
  const visibleRoots = allRoots.filter(cat => cat.is_visible == 1);

  // Sort WITHOUT mutation
  const rootCategories = [...visibleRoots]
    .sort((a, b) => a.id - b.id)
    .map(root => ({
      ...root,
      children: [...(root.children || [])].sort((a, b) => a.id - b.id)
    }));

  // Push to /books?category=<id> while preserving other existing listing filters if any
  const goToCategory = (id) => {
    try {
      const params = new URLSearchParams(location.search);
      params.set('category', String(id));
      // Optionally clear the text query:
      // params.delete('q');
      navigate(`/books?${params.toString()}`);
    } finally {
      setIsOpen(false);
      setHoveredId(null);
    }
  };

  // Auto-open if already on /books?category=...
  useEffect(() => {
    const onBooksWithCategory =
      location.pathname.startsWith('/books') &&
      new URLSearchParams(location.search).has('category');

    if (onBooksWithCategory) {
      setIsOpen(true);
    }
  }, [location.pathname, location.search]);

  const hoverParent = (id) => {
    clearTimeout(timeoutRef.current);
    setHoveredId(id);
    setIsOpen(true);
  };

  const openMenu = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
    setHoveredId('root');
  };

  const closeMenu = () => {
    timeoutRef.current = setTimeout(() => {
      if (hoveredId !== 'root' && !document.querySelector('.dropdown-item-parent:hover')) {
        setIsOpen(false);
        setHoveredId(null);
      }
    }, 350);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div className="category-dropdown" onMouseEnter={openMenu} onMouseLeave={closeMenu}>
      <button className="category-toggle">
        {t('categories')} <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {isLoading ? (
            <div className="dropdown-item">Loading...</div>
          ) : rootCategories.length > 0 ? (
            rootCategories.map(cat => (
              <div
                key={cat.id}
                className="dropdown-item-parent"
                onMouseEnter={() => hoverParent(cat.id)}
                onMouseLeave={closeMenu}
              >
                {/* Root item: click navigates to /books?category=<id> */}
                <button
                  type="button"
                  className="dropdown-item-link"
                  onClick={() => goToCategory(cat.id)}
                >
                  <span className="cat-label">
                    {i18n.language === 'de' ? cat.name_de || cat.name_en : cat.name_en}
                  </span>
                  {cat.children.length > 0 && (
                    <ChevronRight className="arrow-right" aria-hidden />
                  )}
                </button>

                {/* Submenu */}
                {hoveredId === cat.id && cat.children.length > 0 && (
                  <div
                    className="submenu"
                    onMouseEnter={() => hoverParent(cat.id)}
                    onMouseLeave={closeMenu}
                  >
                    {cat.children.map(child => (
                      <button
                        type="button"
                        key={child.id}
                        className="submenu-item"
                        onClick={() => goToCategory(child.id)}
                      >
                        <span className="cat-label">
                          {i18n.language === 'de' ? child.name_de || child.name_en : child.name_en}
                        </span>
                        {/* Optional: show an arrow for submenu as well */}
                        {/* Arrow only if this child has its own children */}
                        {Array.isArray(child.children) && child.children.length > 0 && (
                          <ChevronRight className="arrow-right" aria-hidden />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="dropdown-item">No categories</div>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoryMenu;
