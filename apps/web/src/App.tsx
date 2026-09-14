import React from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { can } from './permissions'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { ContactsPage } from './pages/ContactsPage'
import { LeadsPage } from './pages/LeadsPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { TasksPage } from './pages/TasksPage'
import { UsersPage } from './pages/UsersPage'
import { AuditPage } from './pages/AuditPage'
import { OpportunitiesPage } from './pages/OpportunitiesPage'
import { PipelinePage } from './pages/PipelinePage'
import { CampaignsPage } from './pages/CampaignsPage'
import { FollowUpsPage } from './pages/FollowUpsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'

interface NavItem {
  to: string
  label: string
  end?: boolean
  resource: string
  action: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, resource: 'dashboard', action: 'read' },
  { to: '/companies', label: 'Companies', resource: 'company', action: 'read' },
  { to: '/contacts', label: 'Contacts', resource: 'contact', action: 'read' },
  { to: '/leads', label: 'Leads', resource: 'lead', action: 'read' },
  { to: '/opportunities', label: 'Opportunities', resource: 'opportunity', action: 'read' },
  { to: '/pipeline', label: 'Pipeline', resource: 'pipeline', action: 'read' },
  { to: '/campaigns', label: 'Campaigns', resource: 'campaign', action: 'read' },
  { to: '/follow-ups', label: 'Follow-ups', resource: 'follow-up', action: 'read' },
  { to: '/analytics', label: 'Analytics', resource: 'analytics', action: 'read' },
  { to: '/activities', label: 'Activities', resource: 'activity', action: 'read' },
  { to: '/tasks', label: 'Tasks', resource: 'task', action: 'read' },
  { to: '/users', label: 'Users', resource: 'user', action: 'read' },
  { to: '/audit', label: 'Audit', resource: 'audit', action: 'read' },
]

function RequirePermission({
  resource,
  action,
  children,
}: {
  resource: string
  action: string
  children: React.ReactNode
}) {
  const { actor } = useAuth()
  if (!can(actor, resource, action) && resource !== 'dashboard') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function App() {
  const { actor, logout, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <strong>NAEOS CRM</strong>
        </div>
        <nav>
          {NAV_ITEMS.filter((item) => can(actor, item.resource, item.action)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="actor-info">
            <span className="actor-email">{actor?.email}</span>
            <span className="actor-roles">{actor?.roles.join(', ')}</span>
          </div>
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route
            path="/users"
            element={
              <RequirePermission resource="user" action="read">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/audit"
            element={
              <RequirePermission resource="audit" action="read">
                <AuditPage />
              </RequirePermission>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}