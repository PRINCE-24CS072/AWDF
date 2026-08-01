import { useState } from 'react'

function Contact() {
  const [name, setName] = useState('')

  return (
    <section className="card">
      <h1>Contact Me</h1>
      <p>Fill in the form below and see your input update instantly.</p>
      <label htmlFor="name">Your Name</label>
      <input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
      />
      <p className="preview">Hello, {name || 'friend'}!</p>
    </section>
  )
}

export default Contact
