import { NavLink } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="navbar">
      <h2>Prince Portfolio</h2>
      <div className="nav-links">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/projects">Projects</NavLink>
        <NavLink to="/contact">Contact</NavLink>
      </div>
    </nav>
  )
}

export default Navbar
