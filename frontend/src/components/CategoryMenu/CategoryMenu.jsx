
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

  // Detect desktop (mouse/hover) vs touch
  const canHover = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);
  const isMobile = !canHover;

  // Refs & state
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  const [pos, setPos] = useState({ top: 0, left: 0 });
  const hoverCloseTimer = useRef(null);

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

  // Navigate and close
  const goToCategory = (id) => {
    setIsOpen(false);
    setHoveredId(null);
    setExpandedId(null);
    setMobileListOpen(false);

    const params = new URLSearchParams(location.search);
    params.set('category', String(id));
    navigate(`/books?${params.toString()}`);
  };

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setHoveredId(null);
    setExpandedId(null);
    setMobileListOpen(false);
  }, [location.pathname, location.search]);

  // Toggle menu (ONLY open/close; All Books toggles inside panel)
  const toggleOpen = () => {
    setIsOpen(prev => {
      const next = !prev;

      if (next) {
        // opening
        setMobileListOpen(false);
        setExpandedId(null);
      } else {
        // closing
        setHoveredId(null);
        setExpandedId(null);
        setMobileListOpen(false);
      }
      return next;
    });
  };

  // Position panel under trigger on desktop
  const placePanel = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 12, left: rect.left + rect.width / 2 });
  };

  useEffect(() => {
    if (!isOpen) return;

    // only need positioning on desktop
    if (!isMobile) {
      placePanel();
      window.addEventListener('resize', placePanel);
      window.addEventListener('scroll', placePanel, true);
      return () => {
        window.removeEventListener('resize', placePanel);
        window.removeEventListener('scroll', placePanel, true);
      };
    }
  }, [isOpen, isMobile]);

  // Close on outside click / ESC
  useEffect(() => {
    const onDocClick = (e) => {
      if (!isOpen) return;
      const inTrigger = triggerRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) {
        setIsOpen(false);
        setHoveredId(null);
        setExpandedId(null);
        setMobileListOpen(false);
      }
    };

    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setHoveredId(null);
        setExpandedId(null);
        setMobileListOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isOpen]);

  const startHoverClose = (delay = 140) => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = setTimeout(() => setHoveredId(null), delay);
  };
  const cancelHoverClose = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
  };

  // Desktop hover helpers
  const onHoverParent = (id) => {
    if (!canHover) return;
    setHoveredId(id);
    if (!isOpen) setIsOpen(true);
  };

  // Panel style (desktop anchored, mobile full-screen)
  const panelStyle = isMobile
    ? { position: 'fixed', top: 0, left: 0, transform: 'none' }
    : { position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)' };

  const MenuContent = () => {
    if (isLoading) return <div className="dropdown-item">Loading...</div>;
    if (!roots.length) return <div className="dropdown-item">No categories</div>;

    return (
      <>
        {/* Mobile: always show All Books row */}
        {isMobile && (
          <button
            type="button"
            className="dropdown-item-link all-books-row"
            onClick={() => {
              setMobileListOpen(v => !v);
              setExpandedId(null);
            }}
          >
            <span className="cat-label">All Books</span>
            <ChevronDown className={`chevron ${mobileListOpen ? 'open' : ''}`} aria-hidden />
          </button>
        )}

        {/* Root list:
            Desktop always
            Mobile only when All Books is expanded */}
        {(!isMobile || mobileListOpen) && roots.map(cat => {
          const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
          const isExpanded = expandedId === cat.id;

          return (
            <div
              key={cat.id}
              className="dropdown-item-parent"
              onMouseEnter={() => { cancelHoverClose(); onHoverParent(cat.id); }}
              onMouseLeave={() => { startHoverClose(140); }}
            >
              <button
                type="button"
                className="dropdown-item-link"
                onClick={() => {
                  if (isMobile && hasChildren) {
                    setExpandedId(prev => (prev === cat.id ? null : cat.id));
                    return;
                  }
                  goToCategory(cat.id);
                }}
              >
                <span className="cat-label">
                  {i18n.language === 'de' ? (cat.name_de || cat.name_en) : cat.name_en}
                </span>

                {hasChildren && (
                  <ChevronRight
                    className={`arrow-right ${isExpanded ? 'arrow-right--open' : ''}`}
                    aria-hidden
                  />
                )}
              </button>

              {/* Desktop: hover submenu */}
              {canHover && hoveredId === cat.id && hasChildren && (
                <div
                  className="submenu"
                  onMouseEnter={cancelHoverClose}
                  onMouseLeave={() => startHoverClose(140)}
                >
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

              {/* Mobile: accordion submenu */}
              {isMobile && isExpanded && hasChildren && (
                <div className="submenu submenu--mobile">
                  <button
                    type="button"
                    className="submenu-item"
                    onClick={() => goToCategory(cat.id)}
                  >
                    <span className="cat-label">
                      {i18n.language === 'de'
                        ? `Alle ${cat.name_de || cat.name_en}`
                        : `All ${cat.name_en}`}
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
                        {i18n.language === 'de' ? (child.name_de || child.name_en) : child.name_en}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

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
        <span className="category-toggle-label">
          {isMobile ? 'Browse Categories' : t('categories')}
        </span>
        <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && overlayRoot && createPortal(
        <div
          ref={panelRef}
          className="category-panel dropdown-menu dropdown-menu--portal"
          role="menu"
          style={panelStyle}
        >
          <MenuContent />
        </div>,
        overlayRoot
      )}
    </div>
  );
}

export default CategoryMenu;
