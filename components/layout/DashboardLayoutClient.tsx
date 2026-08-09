"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { TopbarNotification } from "@/components/layout/Topbar";

interface DashboardLayoutClientProps {
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  userAvatarUrl?: string | null;
  allowedModules?: string[];
  notifications?: TopbarNotification[];
  notificationCount?: number;
  children: React.ReactNode;
}

export function DashboardLayoutClient({
  userName,
  userEmail,
  userRole,
  userAvatarUrl,
  allowedModules,
  notifications,
  notificationCount,
  children,
}: DashboardLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dashboard-shell">
      <Sidebar
        allowedModules={allowedModules}
        roleCode={userRole}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />
      <div className="dashboard-main">
        <Topbar
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          userAvatarUrl={userAvatarUrl}
          notifications={notifications}
          notificationCount={notificationCount}
          onMobileToggle={() => setMobileOpen((v) => !v)}
        />
        <main className="dashboard-content">
          {children}
        </main>
      </div>

      <style>{`
        .dashboard-shell {
          display: flex;
          min-height: 100dvh;
          background: #f4f7fb;
          position: relative;
        }

        .dashboard-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }

        .dashboard-content {
          flex: 1;
          padding: 24px 16px 40px;
          overflow-y: auto;
        }

        @media (min-width: 640px) {
          .dashboard-content {
            padding: 32px 24px 48px;
          }
        }

        @media (min-width: 1024px) {
          .dashboard-content {
            padding: 40px 32px 56px;
          }
        }
      `}</style>
    </div>
  );
}
