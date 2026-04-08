import { useEffect, useState } from 'react'

function App() {
  const [solutions, setSolutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('http://127.0.0.1:8000/solutions')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Error al obtener las soluciones')
        }
        return response.json()
      })
      .then((data) => {
        setSolutions(data.solutions)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>Soluciones de optimización GNSS</h1>

      {loading && <p>Cargando soluciones...</p>}
      {error && <p>Error: {error}</p>}

      {!loading && !error && (
        <ul>
          {solutions.map((solution) => (
            <li key={solution.id}>
              <strong>Solución {solution.id}</strong><br />
              Objetivo 1: {solution.objective_1}<br />
              Objetivo 2: {solution.objective_2}<br />
              Número de estaciones: {solution.stations.length}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App