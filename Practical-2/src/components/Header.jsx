function Header({ name, title }) {
  return (
    <header className="header-banner">
      <h1>{name}</h1>
      <p>{title}</p>
      <div className="header-divider"></div>
    </header>
  )
}

export default Header
