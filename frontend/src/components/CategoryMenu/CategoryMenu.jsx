// src/components/CategoryMenu/CategoryMenu.jsx                  {cat.children.map(child => (
{/*import React, { useState, useRef, useEffect, useMemo } from 'react';
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

  // Refs & state
  const triggerRef = useRef(null);     // wraps the "Categories" button
  const panelRef = useRef(null);       // floating panel element
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);    // desktop: which parent is hovered
  const [expandedId, setExpandedId] = useState(null);  // mobile: which parent is expanded
  const [pos, setPos] = useState({ top: 0, left: 0 }); // panel position in viewport coords

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
    const params = new URLSearchParams(location.search);
    params.set('category', String(id));
    navigate(`/books?${params.toString()}`);
    setIsOpen(false); setHoveredId(null); setExpandedId(null);
  };

  // Close on route change
  useEffect(() => {
    setIsOpen(false); setHoveredId(null); setExpandedId(null);
  }, [location.pathname, location.search]);

  // Toggle menu
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


  const startHoverClose = (delay = 140) => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = setTimeout(() => {
      setHoveredId(null);
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

  // Hover helpers (desktop only)
  const onHoverParent = (id) => { if (canHover) { setHoveredId(id); if (!isOpen) setIsOpen(true); } };
  const clearHover = () => { if (canHover) setHoveredId(null); };

  // Menu content (conditions are inlined to prevent "undefined" refs)
  const MenuContent = () => (
    <>
      {isLoading ? (
        <div className="dropdown-item">Loading...</div>
      ) : roots.length > 0 ? (
        roots.map(cat => {
          const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;

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
                  //if (!canHover && hasChildren) {
                  if (!canHover && hasChildren && expandedId !== 'ALL') {
                    setExpandedId(prev => (prev === cat.id ? null : cat.id)); // mobile expand/collapse
                  } else {
                    goToCategory(cat.id); // desktop click goes straight to category
                  }
                }}
              >
                <span className="cat-label">
                  {i18n.language === 'de' ? (cat.name_de || cat.name_en) : cat.name_en}
                </span>
                {hasChildren && <ChevronRight className="arrow-right" aria-hidden />}
              </button>

              // Desktop: hover submenu
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
              // Mobile: accordion submenu 
              {!canHover && expandedId === cat.id && hasChildren && (
                <div className="submenu submenu--mobile">
                  <button
                    type="button"
                    className="submenu-item"
                    onClick={() => goToCategory(cat.id)}
                  >
                    <span className="cat-label">{t('view_all') || 'View all'}</span>
                  </button>

                  {Array.isArray(cat.children) && cat.children.map((child) => (
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

  // Always mount overlay to <body> (robust against header overflow/clip)
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

export default CategoryMenu;*/}


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
  const [allBooksOpen, setAllBooksOpen] = useState(true); // mobile will show list by default

  // Refs & state
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // NEW: controls showing the root list under “All Books” on mobile
  //const [allBooksOpen, setAllBooksOpen] = useState(false);
  //const [allBooksOpen, setAllBooksOpen] = useState(!canHover);

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
    const params = new URLSearchParams(location.search);
    params.set('category', String(id));
    navigate(`/books?${params.toString()}`);

    setIsOpen(false);
    setHoveredId(null);
    setExpandedId(null);
    setAllBooksOpen(false);
  };

  // Navigate to "All Books" (no category param)
  const goToAllBooks = () => {
    const params = new URLSearchParams(location.search);
    params.delete('category');
    const qs = params.toString();
    navigate(qs ? `/books?${qs}` : '/books');

    setIsOpen(false);
    setHoveredId(null);
    setExpandedId(null);
    setAllBooksOpen(false);
  };

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setHoveredId(null);
    setExpandedId(null);
    setAllBooksOpen(false);
  }, [location.pathname, location.search]);

  // Toggle menu (header button)
  /*const toggleOpen = () => {
    setIsOpen(v => !v);
    if (isOpen) {
      setHoveredId(null);
      setExpandedId(null);
      setAllBooksOpen(false);
    } else {
      // opening: start collapsed on mobile
      setAllBooksOpen(false);
      setExpandedId(null);
    }
  };*/

  const toggleOpen = () => {
    setIsOpen(v => !v);

    if (isOpen) {
      // closing
      setHoveredId(null);
      setExpandedId(null);
      setAllBooksOpen(true);
    } else {
      // opening
      setExpandedId(null);
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
      setHoveredId(null);
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
        setHoveredId(null);
        setExpandedId(null);
        setAllBooksOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setHoveredId(null);
        setExpandedId(null);
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

  // Hover helpers (desktop only)
  const onHoverParent = (id) => {
    if (canHover) {
      setHoveredId(id);
      if (!isOpen) setIsOpen(true);
    }
  };

  const MenuContent = () => (
    <>
      {isLoading ? (
        <div className="dropdown-item">Loading...</div>
      ) : roots.length > 0 ? (
        <>
          {/* MOBILE: All Books row is always visible at top */}
          {/*{isMobile && (
            <button
              type="button"
              className="dropdown-item-link all-books-row"
              //onClick={() => {
              //  setAllBooksOpen(v => !v);
              //  setExpandedId(null);
              //}}

              onClick={() => {
                //if (!canHover) return; // don't collapse on mobile
                setAllBooksOpen(v => !v);
                setExpandedId(null);
              }}

            >
              <span className="cat-label">All Books</span>
              <ChevronDown className={`chevron ${allBooksOpen ? 'open' : ''}`} aria-hidden />
            </button>
          )}*/}


          {/* ✅ Mobile: All Books header row */}
          {isMobile && (
            <button
              type="button"
              className="dropdown-item-link all-books-row"
              onClick={() => {
                setAllBooksOpen(prev => !prev);
                setExpandedId(null); // collapse any expanded category when toggling
              }}
            >
              <span className="cat-label">All Books</span>
              <ChevronDown className={`all-books-chevron ${allBooksOpen ? 'open' : ''}`} aria-hidden />
            </button>
          )}


          {/* ROOT list: Desktop always; Mobile only when All Books is expanded */}
          {(!isMobile || allBooksOpen) && roots.map(cat => {
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
                    <button type="button" className="submenu-item" onClick={() => goToCategory(cat.id)}>
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
        {isMobile ? null : t('categories')}{' '}
        <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {/*{isOpen && overlayRoot && createPortal(*/}
      {(isOpen || isMobile) && overlayRoot && createPortal(
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

