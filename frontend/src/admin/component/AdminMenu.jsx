// frontend/src/admin/component/AdminMenu.jsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  List,
  ShoppingCart,
  Package,
  Users,
  LogOut,
  Image,
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const AdminMenu = () => {
  const [footerOpen, setFooterOpen] = useState(true);

  const mainItems = [
    { name: 'Books', path: 'books', icon: <BookOpen className="w-5 h-5" /> },
    { name: 'Authors', path: 'authors', icon: <Users className="w-5 h-5" /> },
    { name: 'Categories', path: 'categories', icon: <List className="w-5 h-5" /> },
    { name: 'Orders', path: 'orders', icon: <Package className="w-5 h-5" /> },
    { name: 'Order Items', path: 'order_items', icon: <ShoppingCart className="w-5 h-5" /> },
    { name: 'Users', path: 'users', icon: <Users className="w-5 h-5" /> },
    { name: 'Wishlist', path: 'wishlist', icon: <Image className="w-5 h-5" /> },
    { name: 'Carts', path: 'carts', icon: <ShoppingCart className="w-5 h-5" /> },
    { name: 'Book Requests', path: 'book-requests', icon: <FileText className="w-5 h-5" /> },
    { name: 'Sessions', path: 'sessions', icon: <LogOut className="w-5 h-5" /> },
    { name: 'Hero Banner', path: 'hero-banner', icon: <Image className="w-5 h-5" /> },
  ];

  const footerPages = [
    { name: 'About Us', path: 'footer/about' },
    { name: 'Contact', path: 'footer/contact' },
    { name: 'FAQ', path: 'footer/faq' },
    { name: 'Returns', path: 'footer/returns' },
    { name: 'Imprint', path: 'footer/imprint' },
    { name: 'Privacy', path: 'footer/privacy' },
    { name: 'Terms (AGB)', path: 'footer/terms' },
    { name: 'Revocation', path: 'footer/revocation' },
    { name: 'Shipping', path: 'footer/shipping' },
  ];

  return (
    <div
      className="w-64 bg-gray-800 text-white fixed left-0 top-16 flex flex-col"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* Fixed header */}
      <div className="p-4 text-xl font-bold border-b border-gray-700 shrink-0">
        Admin Panel
      </div>

      {/* Scrollable menu */}
      <nav className="flex-1 overflow-y-auto p-4 pb-20">
        <ul className="space-y-2">
          {/* Main Items */}
          {mainItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={`/admin/${item.path}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-700'
                  }`
                }
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}

          {/* Footer Pages Section */}
          <li className="pt-6">
            <button
              onClick={() => setFooterOpen(!footerOpen)}
              className="w-full flex items-center justify-between p-3 rounded-lg text-gray-300 hover:bg-gray-700 font-medium transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" />
                <span>Footer Pages</span>
              </div>
              {footerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {footerOpen && (
              <ul className="ml-6 mt-2 space-y-1 border-l-2 border-purple-500">
                {footerPages.map((page) => (
                  <li key={page.name}>
                    <NavLink
                      to={`/admin/${page.path}`}
                      className={({ isActive }) =>
                        `block py-2 px-4 rounded-r-lg text-sm transition-colors ${isActive
                          ? 'bg-purple-600 text-white font-medium'
                          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`
                      }
                    >
                      {page.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default AdminMenu;