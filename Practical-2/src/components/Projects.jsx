function Projects() {
  const projects = [
    { id: 1, name: 'Portfolio Website', description: 'A personal portfolio website built with React and Vite showcasing my projects and skills.' },
    { id: 2, name: 'DataXpert', description: 'A data analysis and visualization tool for extracting insights from CSV and JSON files.' },
    { id: 3, name: 'ScraperTracker', description: 'A web scraping application that tracks and monitors data changes across multiple websites.' },
  ]

  return (
    <section className="card">
      <h1>Projects</h1>
      <div className="projects-list">
        {projects.map((project) => (
          <div key={project.id} className="project-item">
            <h3>{project.name}</h3>
            <p>{project.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Projects
