import { NavLink } from "react-router-dom";
import '../css/components/side-bar.css'

function Item({ to, children, exact = false }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => {
        let cls = "side-btn";
        if (isActive) cls += " active";
        return cls;
      }}
      {...(exact ? { end: true } : {})}
    >
      {children}
    </NavLink>
  );
}

export default function SideBar() {
  return (
    <aside className="SideBar" aria-label="Course planner sidebar">
      <nav aria-label="Main">
        <Item to="/builder">Builder</Item>
        <Item to="/courses">Courses</Item>
        <Item to="/schedule">Schedule</Item>
      </nav>
    </aside>
  );
}
