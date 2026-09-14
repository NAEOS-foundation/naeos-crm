import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

const App = () => (
  <main className="app-shell">
    <h1>NAEOS CRM</h1>
    <p>Phase 1 foundation scaffold initialized.</p>
    <ul>
      <li>Authentication and RBAC to be implemented</li>
      <li>Companies, contacts, leads, activities, and tasks next</li>
      <li>Audit and GO-Gate foundation to follow</li>
    </ul>
  </main>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
