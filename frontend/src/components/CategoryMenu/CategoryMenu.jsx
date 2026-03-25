
// src/components/CategoryMenu/CategoryMenu.jsx
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

  const rootRef = useRef(null); // wraps the trigger button
  const btnRef = useRef(null);  // the "Categories" button
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);   // desktop hover parent id
  const [expandedId, setExpandedId] = useState(null);  // mobile accordion parent id

  // Prepare visible categories in a stable order
  const rootCategories = useMemo(() => {
    const all = Array.isArray(data.hierarchy) ? data.hierarchy : [];
    const visible = all.filter(cat => Number(cat.is_visible) === 1);
    return [...visible]
      .sort((a, b) => a.id - b.id)
      .map(root => ({
        ...root,
        children: [...(root.children || [])].sort((a, b) => a.id - b.id),
      }));
  }, [data.hierarchy]);

  // Navigate and close menu
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

  // Close on outside click / ESC — works with portal
  useEffect(() => {
    const onDocClick = (e) => {
      if (!isOpen) return;
      const overlayRoot = document.querySelector('[data-overlay-root]');
      const panel = overlayRoot?.querySelector('.category-panel');
      const clickedInsideTrigger = rootRef.current?.contains(e.target);
      const clickedInsidePanel = panel?.contains(e.target);
      if (!clickedInsideTrigger && !clickedInsidePanel) {
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

  // Desktop hover open/close
  const onMouseEnterMenu = () => { if (!canHover) return; setIsOpen(true); };
  const onMouseLeaveMenu = (e) => {
    if (!canHover) return;
    const next = e.relatedTarget;
    const overlayRoot = document.querySelector('[data-overlay-root]');
    const panel = overlayRoot?.querySelector('.category-panel');
    const leftEverything =
      (!rootRef.current || (next && !rootRef.current.contains(next))) &&
      (!panel || (next && !panel.contains(next)));
    if (leftEverything) {
      setIsOpen(false); setHoveredId(null);
    }
  };
  const onHoverParent = (id) => { if (!canHover) return; setHoveredId(id); setIsOpen(true); };

  // Mobile toggle
  const toggleMenu = () => {
    setIsOpen(v => !v);
    if (isOpen) { setHoveredId(null); setExpandedId(null); }
  };
  const toggleExpand = (id) => setExpandedId(prev => (prev === id ? null : id));

  // Position the panel directly under the button
  useEffect(() => {
    if (!isOpen || !btnRef.current) return;
    const place = () => {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 12, left: rect.left + rect.width / 2 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  // Menu content (re-used inside portal)
  const MenuContent = () => (
    <>
      {isLoading ? (
        <div className="dropdown-item">Loading...</div>
      ) : rootCategories.length > 0 ? (
        rootCategories.map(cat => {
          const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
          const showSubmenuDesktop = canHover && hoveredId === cat.id && hasChildren;
          const showSubmenuMobile = !canHover && expandedId === cat.id && hasChildren;
          return (
            <div
              key={cat.id}
              className="dropdown-item-parent"
              onMouseEnter={() => onHoverParent(cat.id)}
            >
              <button
                type="button"
                className="dropdown-item-link"
                onClick={() => {
                  if (!canHover && hasChildren) { toggleExpand(cat.id); }
                  else { goToCategory(cat.id); }
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

  // Find the header overlay root (your wrapper on the header)
  const overlayRoot = typeof document !== 'undefined'
    ? (rootRef.current?.closest('[data-overlay-root]') ||
      document.querySelector('[data-overlay-root]') ||
      document.body)
    : null;

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
        ref={btnRef}
      >
        {t('categories')}{' '}
        <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {/* PORTAL: render the open menu under the header's overlay root */}
      {isOpen && overlayRoot && createPortal(
        <div
          className="category-panel dropdown-menu dropdown-menu--portal"
          role="menu"
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
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
