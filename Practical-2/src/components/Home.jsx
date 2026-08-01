import { useState } from 'react'
import Header from './Header'
import About from './About'
import Skills from './Skills'
import Footer from './Footer'

function Home() {
  const [isVisible, setIsVisible] = useState(true)

  const student = {
    name: 'Patel Prince',
    title: 'Student ID: 24CS072',
    intro: 'I am Prince, a Computer Science and Technology student at Charusat University. I am passionate about web development and building innovative solutions.',
    contact: '24cs072@charusat.edu.in',
    skills: ['HTML', 'CSS', 'JavaScript', 'Java', 'Python', 'React', 'Node.js'],
  }

  return (
    <section className="page">
      <Header name={student.name} title={student.title} />
      <button onClick={() => setIsVisible(!isVisible)}>
        {isVisible ? 'Hide intro' : 'Show intro'}
      </button>
      <div className="content-row">
        {isVisible && <About intro={student.intro} />}
        <Skills skills={student.skills} />
      </div>
      {isVisible && <p className="highlight">This section uses useState to toggle visibility.</p>}
      <Footer contact={student.contact} />
    </section>
  )
}

export default Home
