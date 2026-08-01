import './App.css'
import Header from './components/Header'
import About from './components/About'
import Skills from './components/Skills'
import Projects from './components/Projects'
import Footer from './components/Footer'

function App() {
  const student = {
    name: 'Patel Prince',
    title: 'Student ID: 24CS072',
    intro: 'I am Prince, a Computer Science and Technology student at Charusat University. I am passionate about web development and building innovative solutions.',
    contact: '24cs072@charusat.edu.in',
    skills: ['HTML', 'CSS', 'JavaScript', 'Java', 'Python', 'React', 'Node.js'],
    projects: [
      { id: 1, name: 'Portfolio Website', description: 'A personal portfolio website built with React and Vite showcasing my projects and skills.' },
      { id: 2, name: 'DataXpert', description: 'A data analysis and visualization tool for extracting insights from CSV and JSON files.' },
      { id: 3, name: 'ScraperTracker', description: 'A web scraping application that tracks and monitors data changes across multiple websites.' },
    ],
  }

  return (
    <div className="page">
      <Header name={student.name} title={student.title} />
      <div className="content-row">
        <About intro={student.intro} details={{}} />
        <Skills skills={student.skills} />
      </div>
      <Projects projects={student.projects} />
      <Footer contact={student.contact} />
    </div>
  )
}

export default App
