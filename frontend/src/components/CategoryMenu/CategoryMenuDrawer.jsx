
// src/components/CategoryMenu/CategoryMenuDrawer.jsx
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetCategoriesQuery } from '../../admin/features/book/bookApiSlice';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './CategoryMenu.css';

export default function CategoryMenuDrawer({ onNavigate }) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { data = { hierarchy: [] }, isLoading } = useGetCategoriesQuery();

  const [allBooksOpen, setAllBooksOpen] = useState(true);
  // One open id per level: [level1Id, level2Id, ...] so the drawer nests to any depth
  const [expandedPath, setExpandedPath] = useState([]);

  // ✅ IMPORTANT: roots IS DEFINED HERE (children sorted at every level)
  const roots = useMemo(() => {
    const all = Array.isArray(data.hierarchy) ? data.hierarchy : [];
    const visible = all.filter(c => Number(c.is_visible) === 1);
    const sortTree = (nodes) =>
      [...(nodes || [])]
        .sort((a, b) => a.id - b.id)
        .map(n => ({ ...n, children: sortTree(n.children) }));
    return sortTree(visible);
  }, [data.hierarchy]);

  const closeDrawer = () => onNavigate?.();

  const goToAllBooks = () => {
    const params = new URLSearchParams(location.search);
    params.delete('category');
    const qs = params.toString();
    navigate(qs ? `/books?${qs}` : '/books');
    closeDrawer();
  };

  const goToCategory = (id) => {
    const params = new URLSearchParams(location.search);
    params.set('category', String(id));
    navigate(`/books?${params.toString()}`);
    closeDrawer();
  };

  const labelOf = (c) => (i18n.language === 'de' ? (c.name_de || c.name_en) : c.name_en);

  const toggleExpanded = (id, depth) => {
    setExpandedPath(prev =>
      prev[depth] === id ? prev.slice(0, depth) : [...prev.slice(0, depth), id]
    );
  };

  const renderChildren = (parent, depth) => (
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
            {hasKids && open && renderChildren(child, depth + 1)}
          </div>
        );
      })}
    </div>
  );

  if (isLoading) return <div className="dropdown-item">Loading...</div>;
  if (!roots.length) return <div className="dropdown-item">No categories</div>;

  return (
    <div className="category-drawer">
      {/* All Books row */}
      <button
        type="button"
        className="dropdown-item-link all-books-row"
        onClick={() => {
          setAllBooksOpen(v => !v);
          setExpandedPath([]);
        }}
      >
        <span className="cat-label">All Books</span>
        <ChevronDown className={`chevron ${allBooksOpen ? 'open' : ''}`} aria-hidden />
      </button>

      {/*<button
        type="button"
        className="submenu-item submenu-item--allbooks"
        onClick={goToAllBooks}
      >
        <span className="cat-label">
          {i18n.language === 'de' ? 'Alle Bücher anzeigen' : 'View all books'}
        </span>
      </button>*/}

      {/* Root list */}
      {allBooksOpen && roots.map(cat => {
        const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
        const isExpanded = expandedPath[0] === cat.id;

        return (
          <div key={cat.id} className="dropdown-item-parent">
            <button
              type="button"
              className="dropdown-item-link"
              onClick={() => {
                if (hasChildren) {
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

            {hasChildren && isExpanded && renderChildren(cat, 0)}
          </div>
        );
      })}
    </div>
  );
}
