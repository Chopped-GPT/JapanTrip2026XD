import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import SideBar from './components/SideBar.jsx';
import Builder from './pages/Builder.jsx';
import Schedule from './pages/Schedule.jsx';
import Courses from './pages/Courses.jsx';
import './css/App.css'

function Layout() {
  return (
    <div className="app">
      <SideBar />
      <div className="main"><Outlet /></div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All routes below share the same Layout (sidebar + content area) */}
        <Route element={<Layout />}>
          {/* Default route: going to "/" sends you to /builder */}
          <Route index element={<Navigate to="/builder" replace />} />

          {/* Your three main pages (each gets its own URL) */}
          <Route path="builder" element={<Builder />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="courses" element={<Courses />} />

          {/* Catch-all: anything else shows a simple 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <section className="main">
      <div className="chat" style={{ paddingTop: 24 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Page not found</h2>
          <p>Use the sidebar to navigate.</p>
        </div>
      </div>
      <div className="input-bar"><div className="muted">404</div></div>
    </section>
  );
}
