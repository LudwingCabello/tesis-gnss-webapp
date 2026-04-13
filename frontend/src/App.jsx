import { useState } from "react"

function App() {
  const [rasterFile, setRasterFile] = useState(null)
  const [stationsFile, setStationsFile] = useState(null)
  const [nStations, setNStations] = useState(0)
  const [response, setResponse] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const formData = new FormData()
    formData.append("raster_file", rasterFile)
    formData.append("stations_file", stationsFile)
    formData.append("n_stations", nStations)

    try {
      const res = await fetch("http://localhost:8000/scenario", {
        method: "POST",
        body: formData
      })

      const data = await res.json()
      setResponse(data)

    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>GNSS Optimización</h1>

      <form onSubmit={handleSubmit}>

        <div>
          <label>Raster (.geojson): </label>
          <input
            type="file"
            onChange={(e) => setRasterFile(e.target.files[0])}
          />
        </div>

        <div>
          <label>Estaciones (.csv): </label>
          <input
            type="file"
            onChange={(e) => setStationsFile(e.target.files[0])}
          />
        </div>

        <div>
          <label>Número de estaciones: </label>
          <input
            type="number"
            value={nStations}
            onChange={(e) => setNStations(e.target.value)}
          />
        </div>

        <button type="submit">Enviar</button>
      </form>

      {response && (
        <div style={{ marginTop: "20px" }}>
          <h2>Respuesta:</h2>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export default App