// frontend/src/pages/GiftLists/GiftListTabs.jsx
// Small tab bar shared by "My Gift Lists" and "Lists I gave from".
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gift, HeartHandshake } from 'lucide-react';

export default function GiftListTabs() {
  const { t } = useTranslation();
  const cls = ({ isActive }) => 'gl-tab' + (isActive ? ' is-active' : '');
  return (
    <nav className="gl-tabs" aria-label="Gift lists">
      <NavLink to="/lists" end className={cls}>
        <Gift size={15} /> {t('gift_tab_my_lists') || 'My lists'}
      </NavLink>
      <NavLink to="/lists/given" className={cls}>
        <HeartHandshake size={15} /> {t('gift_tab_given') || 'Lists I gave from'}
      </NavLink>
    </nav>
  );
}
