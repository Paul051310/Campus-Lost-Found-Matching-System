import { NavLink } from "react-router-dom";

function Navbar() {
  const getLinkClass = ({ isActive }) =>
    `menu-item${isActive ? " active" : ""}`;

  return (
    <aside className="sidebar">
      {/* CampusFind Brand */}
      <div className="brand">
        <div className="brand-icon">C</div>

        <div>
          <span>CampusFind</span>
          <p
            style={{
              margin: "4px 0 0",
              color: "#c4cbe0",
              fontSize: "12px",
              fontWeight: 400,
            }}
          >
            Lost &amp; Found
          </p>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <nav className="sidebar-nav">
        <NavLink to="/" end className={getLinkClass}>
          <span className="icon">▦</span>
          Dashboard
        </NavLink>

        <NavLink to="/browse" className={getLinkClass}>
          <span className="icon">⌕</span>
          Browse Items
        </NavLink>

        <NavLink to="/matches" className={getLinkClass}>
          <span className="icon">⇄</span>
          Possible Matches
        </NavLink>

        <NavLink to="/report" className={getLinkClass}>
          <span className="icon">＋</span>
          Report an Item
        </NavLink>

        <NavLink to="/assistant" className={getLinkClass}>
          <span className="icon">✦</span>
          AI Assistant
        </NavLink>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <p>College of Maasin</p>
        <small>Campus Lost &amp; Found</small>
      </div>
    </aside>
  );
}

export default Navbar;