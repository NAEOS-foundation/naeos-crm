import React, { useState } from 'react'
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
import { ContributorsPage } from './pages/ContributorsPage'
import { PartnersPage } from './pages/PartnersPage'
import { CommunitiesPage } from './pages/CommunitiesPage'
import { InvestorsPage } from './pages/InvestorsPage'
import { UseCasesPage } from './pages/UseCasesPage'
import { GoGatePage } from './pages/GoGatePage'
import { PoliciesPage } from './pages/PoliciesPage'

interface NavItem {
  to: string
  label: string
  end?: boolean
  resource: string
  action: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/', label: 'Dashboard', end: true, resource: 'dashboard', action: 'read' },
      { to: '/tasks', label: 'Tasks', resource: 'task', action: 'read' },
      { to: '/activities', label: 'Activities', resource: 'activity', action: 'read' },
    ],
  },
  {
    label: 'Relationships',
    items: [
      { to: '/companies', label: 'Companies', resource: 'company', action: 'read' },
      { to: '/contacts', label: 'Contacts', resource: 'contact', action: 'read' },
      { to: '/leads', label: 'Leads', resource: 'lead', action: 'read' },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { to: '/opportunities', label: 'Opportunities', resource: 'opportunity', action: 'read' },
      { to: '/pipeline', label: 'Pipeline', resource: 'pipeline', action: 'read' },
      { to: '/campaigns', label: 'Campaigns', resource: 'campaign', action: 'read' },
      { to: '/follow-ups', label: 'Follow-ups', resource: 'follow-up', action: 'read' },
    ],
  },
  {
    label: 'Ecosystem',
    items: [
      { to: '/contributors', label: 'Contributors', resource: 'contributor', action: 'read' },
      { to: '/partners', label: 'Partners', resource: 'partner', action: 'read' },
      { to: '/communities', label: 'Communities', resource: 'community', action: 'read' },
      { to: '/investors', label: 'Investors', resource: 'investor', action: 'read' },
      { to: '/use-cases', label: 'Use Cases', resource: 'use-case', action: 'read' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/go-gate', label: 'GO-Gate', resource: 'go-gate', action: 'read' },
      { to: '/policy', label: 'Policy', resource: 'policy', action: 'read' },
      { to: '/audit', label: 'Audit', resource: 'audit', action: 'read' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/analytics', label: 'Analytics', resource: 'analytics', action: 'read' },
      { to: '/users', label: 'Users', resource: 'user', action: 'read' },
    ],
  },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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
      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside id="crm-sidebar" className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/naeos-brand-mark.svg" alt="NAEOS" className="sidebar-brand-mark" />
          <div className="sidebar-brand-name">
            <strong>NAEOS</strong>
            <span>CRM</span>
          </div>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="CRM navigation">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => can(actor, item.resource, item.action))
            if (visibleItems.length === 0) return null

            return (
              <div className="nav-group" key={group.label}>
                <h2 className="nav-group-label">{group.label}</h2>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
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
        <div className="mobile-workspace-header">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-expanded={mobileNavOpen}
            aria-controls="crm-sidebar"
            onClick={() => setMobileNavOpen(true)}
          >
            <span aria-hidden="true">☰</span>
            <span>Menu</span>
          </button>
          <span className="mobile-workspace-name">NAEOS CRM</span>
        </div>
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
          <Route path="/contributors" element={<ContributorsPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/communities" element={<CommunitiesPage />} />
          <Route path="/investors" element={<InvestorsPage />} />
          <Route path="/use-cases" element={<UseCasesPage />} />
          <Route path="/go-gate" element={<GoGatePage />} />
          <Route
            path="/policy"
            element={
              <RequirePermission resource="policy" action="read">
                <PoliciesPage />
              </RequirePermission>
            }
          />
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
