// frontend/src/admin/components/AdminLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminMenu from './AdminMenu';

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <AdminMenu />

      {/* Main content – pushes footer down automatically */}
      <div className="ml-64 flex-1 flex flex-col">
        <main className="flex-1 p-6 pb-32">   {/* ← this pb-32 is the magic */}
          <Outlet />
        </main>

        {/* ← your global Footer component (outside) */}
      </div>
    </div>
  );
};

export default AdminLayout;