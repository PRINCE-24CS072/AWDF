function Footer({ contact }) {
  return (
    <footer className="contact-footer">
      <p>Get in Touch:  <a href={`mailto:${contact}`}>{contact}</a></p>
    </footer>
  )
}

export default Footer
