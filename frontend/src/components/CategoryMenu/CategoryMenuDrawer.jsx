
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
  const [expandedId, setExpandedId] = useState(null);

  // ✅ IMPORTANT: roots IS DEFINED HERE
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
          setExpandedId(null);
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
        const isExpanded = expandedId === cat.id;

        return (
          <div key={cat.id} className="dropdown-item-parent">
            <button
              type="button"
              className="dropdown-item-link"
              onClick={() => {
                if (hasChildren) {
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

            {hasChildren && isExpanded && (
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
                    key={child.id}
                    type="button"
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
      })}
    </div>
  );
}
