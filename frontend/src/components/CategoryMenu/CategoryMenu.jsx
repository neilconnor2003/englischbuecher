
// src/components/CategoryMenu/CategoryMenu.jsx hasChildren;
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetCategoriesQuery } from '../../admin/features/book/bookApiSlice';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './CategoryMenu.css';
import { createPortal } from 'react-dom';

function CategoryMenu() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { data = { hierarchy: [] }, isLoading } = useGetCategoriesQuery();

  // Detect desktop hover vs touch
  const canHover = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);

  // Refs and state
  const triggerRef = useRef(null);   // the "Categories" button wrapper
  const panelRef = useRef(null);     // the floating panel
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);   // desktop hover: which parent is hovered
  const [expandedId, setExpandedId] = useState(null); // mobile: which parent is expanded
  const [pos, setPos] = useState({ top: 0, left: 0 }); // panel position (viewport coords)

  // Visible, sorted categories
  const roots = useMemo(() => {
    const all = Array.isArray(data.hierarchy) ? data.hierarchy : [];
    const visible = all.filter(c => Number(c.is_visible) === 1);
    return [...visible]
      .sort((a, b) => a.id - b.id)
      .map(root => ({
        ...root,
        children: [...(root.children || [])].sort((a, b) => a.id - b.id),
      }));
  }, [data.hierarchy]);

  // Navigate to category and close
  const goToCategory = (id) => {
    const params = new URLSearchParams(location.search);
    params.set('category', String(id));
    navigate(`/books?${params.toString()}`);
    setIsOpen(false); setHoveredId(null); setExpandedId(null);
  };

  // Close on route change
  useEffect(() => {
    setIsOpen(false); setHoveredId(null); setExpandedId(null);
  }, [location.pathname, location.search]);

  // Toggle
  const toggleOpen = () => {
    setIsOpen(v => !v);
    if (isOpen) { setHoveredId(null); setExpandedId(null); }
  };

  // Position panel just under the trigger button
  const placePanel = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 12, left: rect.left + rect.width / 2 });
  };

  useEffect(() => {
    if (!isOpen) return;
    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [isOpen]);

  // Close on outside click / ESC (works with body-portal)
  useEffect(() => {
    const onDocClick = (e) => {
      if (!isOpen) return;
      const inTrigger = triggerRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) {
        setIsOpen(false); setHoveredId(null); setExpandedId(null);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false); setHoveredId(null); setExpandedId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isOpen]);

  // Hover helpers (desktop)
  const onHoverParent = (id) => { if (canHover) { setHoveredId(id); if (!isOpen) setIsOpen(true); } };
  const clearHover = () => { if (canHover) setHoveredId(null); };

  // Menu content
  const MenuContent = () => (
    <>
      {isLoading ? (
        <div className="dropdown-item">Loading...</div>
      ) : roots.length > 0 ? (
        roots.map(cat => {
          const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
          const showSubmenuDesktop = canHover && hoveredId === cat.id && hasChildren;

          return (
            <div
              key={cat.id}
              className="dropdown-item-parent"
              onMouseEnter={() => onHoverParent(cat.id)}
              onMouseLeave={clearHover}
            >
              <button
                type="button"
                className="dropdown-item-link"
                onClick={() => {
                  if (!canHover && hasChildren) { // mobile: expand/collapse
                    setExpandedId(prev => (prev === cat.id ? null : cat.id));
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

              {showSubmenuDesktop && (
                <div className="submenu">
                  <button type="button" className="submenu-item" onClick={() => goToCategory(cat.id)}>
                    <span className="cat-label">{t('view_all') || 'View all'}</span>
                  </button>
                  {cat.children.map(child => (
                    <button
                      type="button"
                      key={child.id}
                      className="submenu-item"
                      onClick={() => goToCategory(child.id)}
                    >
                      <span className="cat-label">
                        {i18n.language === 'de' ? (child.name_de || child.name_en) : child.name_en}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showSubmenuMobile && (
                <div className="submenu submenu--mobile">
                  <button type="button" className="submenu-item" onClick={() => goToCategory(cat.id)}>
                    <span className="cat-label">{t('view_all') || 'View all'}</span>
                  </button>
                  {cat.children.map(child => (
                    <button
                      type="button"
                      key={child.id}
                      className="submenu-item"
                      onClick={() => goToCategory(child.id)}
                    >
                      <span className="cat-label">
                        {i18n.language === 'de' ? (child.name_de || child.name_en) : child.name_en}
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
    </>
  );

  // Always portal to <body> (robust, independent of header)
  const overlayRoot = typeof document !== 'undefined' ? document.body : null;

  return (
    <div className="category-dropdown" ref={triggerRef}>
      <button
        type="button"
        className="category-toggle"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {t('categories')}{' '}
        <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && overlayRoot && createPortal(
        <div
          ref={panelRef}
          className="category-panel dropdown-menu dropdown-menu--portal"
          role="menu"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-50%)'
          }}
        >
          <MenuContent />
        </div>,
        overlayRoot
      )}
    </div>
  );
}

export default CategoryMenu;
