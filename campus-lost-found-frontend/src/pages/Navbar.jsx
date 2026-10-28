import { useState } from "react";
import { NavLink } from "react-router-dom";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const getLinkClass = ({ isActive }) =>
    `menu-item${isActive ? " active" : ""}`;

  const closeMenu = () => setMenuOpen(false);

  return (
    <aside className={`sidebar${menuOpen ? " menu-open" : ""}`}>
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

      {/* 3-bar menu button (shown on phones only) */}
      <button
        type="button"
        className={`menu-toggle${menuOpen ? " open" : ""}`}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((previous) => !previous)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Sidebar Navigation */}
      <nav className={`sidebar-nav${menuOpen ? " open" : ""}`}>
        <NavLink to="/" end className={getLinkClass} onClick={closeMenu}>
          <span className="icon">▦</span>
          Dashboard
        </NavLink>

        <NavLink to="/browse" className={getLinkClass} onClick={closeMenu}>
          <span className="icon">⌕</span>
          Browse Items
        </NavLink>

        <NavLink to="/matches" className={getLinkClass} onClick={closeMenu}>
          <span className="icon">⇄</span>
          Possible Matches
        </NavLink>

        <NavLink to="/report" className={getLinkClass} onClick={closeMenu}>
          <span className="icon">＋</span>
          Report an Item
        </NavLink>

        <NavLink to="/assistant" className={getLinkClass} onClick={closeMenu}>
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