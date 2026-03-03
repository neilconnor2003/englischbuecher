
// src/components/CategoryMenu/CategoryMenu.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetCategoriesQuery } from '../../admin/features/book/bookApiSlice';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './CategoryMenu.css';

function CategoryMenu() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const { data = { hierarchy: [] }, isLoading } = useGetCategoriesQuery();

  // Detect whether the device supports hover (desktop) or not (mobile/touch)
  const canHover = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);

  const rootRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);

  // Desktop hover active root id
  const [hoveredId, setHoveredId] = useState(null);

  // Mobile accordion expanded root id
  const [expandedId, setExpandedId] = useState(null);

  // Build sorted visible roots without mutation
  const rootCategories = useMemo(() => {
    const allRoots = Array.isArray(data.hierarchy) ? data.hierarchy : [];
    const visibleRoots = allRoots.filter(cat => Number(cat.is_visible) === 1);

    return [...visibleRoots]
      .sort((a, b) => a.id - b.id)
      .map(root => ({
        ...root,
        children: [...(root.children || [])].sort((a, b) => a.id - b.id)
      }));
  }, [data.hierarchy]);

  const goToCategory = (id) => {
    const params = new URLSearchParams(location.search);
    params.set('category', String(id));
    navigate(`/books?${params.toString()}`);

    // Close menu after navigation (both desktop and mobile)
    setIsOpen(false);
    setHoveredId(null);
    setExpandedId(null);
  };

  // Close on route change (prevents “stuck open”)
  useEffect(() => {
    setIsOpen(false);
    setHoveredId(null);
    setExpandedId(null);
  }, [location.pathname, location.search]);

  // Close on outside click (desktop & mobile)
  useEffect(() => {
    const onDocClick = (e) => {
      if (!isOpen) return;
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
        setHoveredId(null);
        setExpandedId(null);
      }
    };

    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setHoveredId(null);
        setExpandedId(null);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isOpen]);

  // Desktop hover handlers (only if canHover)
  const onMouseEnterMenu = () => {
    if (!canHover) return;
    setIsOpen(true);
  };

  const onMouseLeaveMenu = (e) => {
    if (!canHover) return;
    // If we truly left the whole menu, close
    const next = e.relatedTarget;
    if (!rootRef.current || (next && rootRef.current.contains(next))) return;
    setIsOpen(false);
    setHoveredId(null);
  };

  const onHoverParent = (id) => {
    if (!canHover) return;
    setHoveredId(id);
    setIsOpen(true);
  };

  // Mobile toggle open/close
  const toggleMenu = () => {
    setIsOpen(v => !v);
    if (isOpen) {
      setHoveredId(null);
      setExpandedId(null);
    }
  };

  // Mobile expand/collapse parent
  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div
      className="category-dropdown"
      ref={rootRef}
      onMouseEnter={onMouseEnterMenu}
      onMouseLeave={onMouseLeaveMenu}
    >
      <button
        type="button"
        className="category-toggle"
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {t('categories')}{' '}
        <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="dropdown-menu" role="menu">
          {isLoading ? (
            <div className="dropdown-item">Loading...</div>
          ) : rootCategories.length > 0 ? (
            rootCategories.map(cat => {
              const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;

              // Desktop: show submenu on hover
              const showSubmenuDesktop = canHover && hoveredId === cat.id && hasChildren;

              // Mobile: show submenu if expanded
              const showSubmenuMobile = !canHover && expandedId === cat.id && hasChildren;

              return (
                <div
                  key={cat.id}
                  className="dropdown-item-parent"
                  onMouseEnter={() => onHoverParent(cat.id)}
                >
                  {/* Desktop: clicking goes to category */}
                  {/* Mobile: clicking toggles expand if it has children, otherwise navigates */}
                  <button
                    type="button"
                    className="dropdown-item-link"
                    onClick={() => {
                      if (!canHover && hasChildren) {
                        toggleExpand(cat.id);
                      } else {
                        goToCategory(cat.id);
                      }
                    }}
                  >
                    <span className="cat-label">
                      {i18n.language === 'de' ? (cat.name_de || cat.name_en) : cat.name_en}
                    </span>
                    {hasChildren && <ChevronRight className="arrow-right" aria-hidden />}
                  </button>

                  {/* Submenu: Desktop hover */}
                  {showSubmenuDesktop && (
                    <div className="submenu">
                      {/* Optional: allow "View all" for parent */}
                      <button
                        type="button"
                        className="submenu-item"
                        onClick={() => goToCategory(cat.id)}
                      >
                        <span className="cat-label">
                          {t('view_all') || 'View all'}
                        </span>
                      </button>

                      {cat.children.map(child => (
                        <button
                          type="button"
                          key={child.id}
                          className="submenu-item"
                          onClick={() => goToCategory(child.id)}
                        >
                          <span className="cat-label">
                            {i18n.language === 'de'
                              ? (child.name_de || child.name_en)
                              : child.name_en}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Submenu: Mobile accordion */}
                  {showSubmenuMobile && (
                    <div className="submenu submenu--mobile">
                      <button
                        type="button"
                        className="submenu-item"
                        onClick={() => goToCategory(cat.id)}
                      >
                        <span className="cat-label">
                          {t('view_all') || 'View all'}
                        </span>
                      </button>

                      {cat.children.map(child => (
                        <button
                          type="button"
                          key={child.id}
                          className="submenu-item"
                          onClick={() => goToCategory(child.id)}
                        >
                          <span className="cat-label">
                            {i18n.language === 'de'
                              ? (child.name_de || child.name_en)
                              : child.name_en}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="dropdown-item">No categories</div>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoryMenu;
