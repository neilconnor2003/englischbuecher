
// src/components/CategoryMenu/CategoryMenu.jsx
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
  const [allBooksOpen, setAllBooksOpen] = useState(true); // mobile will show list by default

  // Refs & state
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  // Paths of open category ids, one entry per level: [level1Id, level2Id, ...]
  // (replaces the old single hoveredId/expandedId so menus can nest any depth)
  const [hoveredPath, setHoveredPath] = useState([]);
  const [expandedPath, setExpandedPath] = useState([]);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const hoverCloseTimer = useRef(null);

  // Visible, sorted categories
  const roots = useMemo(() => {
    const all = Array.isArray(data.hierarchy) ? data.hierarchy : [];
    const visible = all.filter(c => Number(c.is_visible) === 1);
    const sortTree = (nodes) =>
      [...(nodes || [])]
        .sort((a, b) => a.id - b.id)
        .map(n => ({ ...n, children: sortTree(n.children) }));
    return sortTree(visible);
  }, [data.hierarchy]);

  // Navigate and close
  const goToCategory = (id) => {
    const params = new URLSearchParams(location.search);
    params.set('category', String(id));
    navigate(`/books?${params.toString()}`);

    setIsOpen(false);
    setHoveredPath([]);
    setExpandedPath([]);
    setAllBooksOpen(false);
  };

  // Navigate to "All Books" (no category param)
  const goToAllBooks = () => {
    const params = new URLSearchParams(location.search);
    params.delete('category');
    const qs = params.toString();
    navigate(qs ? `/books?${qs}` : '/books');

    setIsOpen(false);
    setHoveredPath([]);
    setExpandedPath([]);
    setAllBooksOpen(false);
  };

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setHoveredPath([]);
    setExpandedPath([]);
    setAllBooksOpen(false);
  }, [location.pathname, location.search]);

  const toggleOpen = () => {
    setIsOpen(v => !v);

    if (isOpen) {
      // closing
      setHoveredPath([]);
      setExpandedPath([]);
      setAllBooksOpen(true);
    } else {
      // opening
      setExpandedPath([]);
      setAllBooksOpen(true); // ✅ start with All Books open on mobile
    }
  };


  // Position panel just under the trigger button (and clamp a bit to viewport)
  const placePanel = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const center = rect.left + rect.width / 2;

    // keep center within viewport so menu doesn't go offscreen
    const clampedCenter = Math.min(Math.max(center, 16), window.innerWidth - 16);

    setPos({
      top: rect.bottom + 12,
      left: clampedCenter,
    });
  };

  const startHoverClose = (delay = 140) => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = setTimeout(() => {
      setHoveredPath([]);
    }, delay);
  };
  const cancelHoverClose = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
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
        setIsOpen(false);
        setHoveredPath([]);
        setExpandedPath([]);
        setAllBooksOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setHoveredPath([]);
        setExpandedPath([]);
        setAllBooksOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isOpen]);

  // Keep flyouts on screen: if a flyout would run past the right edge of the
  // window, open it to the LEFT of its parent instead (any depth).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const flyouts = panel.querySelectorAll('.submenu:not(.submenu--mobile)');
    flyouts.forEach(el => el.classList.remove('submenu--flip'));
    flyouts.forEach(el => {            // outer flyouts first, so inner ones see the result
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth - 8) el.classList.add('submenu--flip');
    });
  }, [hoveredPath, isOpen]);

  // Hover helpers (desktop only). depth 0 = top-level category.
  const onHoverNode = (id, depth) => {
    if (canHover) {
      setHoveredPath(prev => [...prev.slice(0, depth), id]);
      if (!isOpen) setIsOpen(true);
    }
  };

  // Mobile accordion: open/close a node at a given depth
  const toggleExpanded = (id, depth) => {
    setExpandedPath(prev =>
      prev[depth] === id ? prev.slice(0, depth) : [...prev.slice(0, depth), id]
    );
  };

  const labelOf = (c) => (i18n.language === 'de' ? (c.name_de || c.name_en) : c.name_en);

  // Desktop: flyout list for `parent`, nests to any depth
  const renderDesktopChildren = (parent, depth) => (
    <div
      className="submenu"
      onMouseEnter={cancelHoverClose}
      onMouseLeave={() => startHoverClose(140)}
    >
      <button type="button" className="submenu-item" onClick={() => goToCategory(parent.id)}>
        <span className="cat-label">{t('view_all') || 'View all'}</span>
      </button>

      {parent.children.map(child => {
        const hasKids = child.children.length > 0;
        return (
          <div
            key={child.id}
            className="dropdown-item-parent"
            onMouseEnter={() => { cancelHoverClose(); onHoverNode(child.id, depth + 1); }}
          >
            <button type="button" className="submenu-item" onClick={() => goToCategory(child.id)}>
              <span className="cat-label">{labelOf(child)}</span>
              {hasKids && <ChevronRight className="arrow-right" aria-hidden />}
            </button>
            {hasKids && hoveredPath[depth + 1] === child.id && renderDesktopChildren(child, depth + 1)}
          </div>
        );
      })}
    </div>
  );

  // Mobile: accordion list for `parent`, nests to any depth
  const renderMobileChildren = (parent, depth) => (
    <div className="submenu submenu--mobile">
      <button type="button" className="submenu-item" onClick={() => goToCategory(parent.id)}>
        <span className="cat-label">
          {i18n.language === 'de' ? `Alle ${labelOf(parent)}` : `All ${parent.name_en}`}
        </span>
      </button>

      {parent.children.map(child => {
        const hasKids = child.children.length > 0;
        const open = expandedPath[depth + 1] === child.id;
        return (
          <div key={child.id}>
            <button
              type="button"
              className="submenu-item"
              onClick={() => (hasKids ? toggleExpanded(child.id, depth + 1) : goToCategory(child.id))}
            >
              <span className="cat-label">{labelOf(child)}</span>
              {hasKids && (
                <ChevronRight className={`arrow-right ${open ? 'arrow-right--open' : ''}`} aria-hidden />
              )}
            </button>
            {hasKids && open && renderMobileChildren(child, depth + 1)}
          </div>
        );
      })}
    </div>
  );

  const MenuContent = () => (
    <>
      {isLoading ? (
        <div className="dropdown-item">Loading...</div>
      ) : roots.length > 0 ? (
        <>
          {/* ✅ Mobile: All Books header row */}
          {isMobile && (
            <button
              type="button"
              className="dropdown-item-link all-books-row"
              onClick={() => {
                setAllBooksOpen(prev => !prev);
                setExpandedPath([]); // collapse any expanded category when toggling
              }}
            >
              <span className="cat-label">All Books</span>
              <ChevronDown className={`all-books-chevron ${allBooksOpen ? 'open' : ''}`} aria-hidden />
            </button>
          )}


          {/* ROOT list: Desktop always; Mobile only when All Books is expanded */}
          {(!isMobile || allBooksOpen) && roots.map(cat => {
            const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
            const isExpanded = expandedPath[0] === cat.id;

            return (
              <div
                key={cat.id}
                className="dropdown-item-parent"
                onMouseEnter={() => { cancelHoverClose(); onHoverNode(cat.id, 0); }}
                onMouseLeave={() => { startHoverClose(140); }}
              >
                <button
                  type="button"
                  className="dropdown-item-link"
                  onClick={() => {
                    if (isMobile && hasChildren) {
                      toggleExpanded(cat.id, 0);
                    } else {
                      goToCategory(cat.id);
                    }
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

                {/* Desktop: hover flyout (nests to any depth) */}
                {canHover && hoveredPath[0] === cat.id && hasChildren && renderDesktopChildren(cat, 0)}

                {/* Mobile: accordion (nests to any depth) */}
                {isMobile && isExpanded && hasChildren && renderMobileChildren(cat, 0)}
              </div>
            );
          })}
        </>
      ) : (
        <div className="dropdown-item">No categories</div>
      )}
    </>
  );

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
        {/*{t('categories')}{' '}*/}
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

