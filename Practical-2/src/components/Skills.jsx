function Skills({ skills }) {
  return (
    <section className="content-box skills-box">
      <h2>My Skills</h2>
      <div className="skills-grid">
        {skills.map((skill) => (
          <span key={skill} className="skill-tag">
            {skill}
          </span>
        ))}
      </div>
    </section>
  )
}

export default Skills
