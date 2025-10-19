import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import SideBar from "./components/SideBar.jsx";
import Builder from "./pages/Builder.jsx";
import Schedule from "./pages/Schedule.jsx";
import Courses from "./pages/Courses.jsx";
import "./css/App.css";

function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <SideBar />
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <section className="main">
      <div style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Page not found</h2>
        <p>Use the sidebar to navigate.</p>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/builder" replace />} />
          <Route path="builder" element={<Builder />} />
          <Route path="courses" element={<Courses />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
