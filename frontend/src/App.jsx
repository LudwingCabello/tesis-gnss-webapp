
import { useState } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"

function App() {
  // Estados para almacenar los archivos, número de estaciones y respuesta del backend
  const [rasterFile, setRasterFile] = useState(null)
  const [stationsFile, setStationsFile] = useState(null)
  const [nStations, setNStations] = useState(0)
  const [response, setResponse] = useState(null)
  // Manejo del envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault()
    // Validación de archivos y número de estaciones
    const formData = new FormData()
    formData.append("raster_file", rasterFile)
    formData.append("stations_file", stationsFile)
    formData.append("n_stations", nStations)
    // Envío de datos al endpoint scenario del backend
    try {
      const res = await fetch("http://localhost:8000/scenario", {
        method: "POST",
        body: formData
      })
      // interpreta respuesta como JSON convirtiendolo a objeto JavaScript
      const data = await res.json()
      //guardando el objeto en response
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
          <h2>Resultado del Escenario</h2>

          {/* Resumen */}
          <h3>Resumen</h3>
          <p>Raster: {response.scenario.raster_filename}</p>
          <p>Estaciones: {response.scenario.stations_filename}</p>
          <p>N° de estaciones solicitadas: {response.scenario.n_stations}</p>

          {/* Raster */}
          <h3>Raster</h3>
          <p>Tipo: {response.raster.geojson_type}</p>
          <p>Features: {response.raster.features_count}</p>
          <p>CRS: {response.raster.has_crs ? "Sí" : "No"}</p>

          {/* Estaciones */}
          <h3>Estaciones</h3>
          <p>Total: {response.stations.total}</p>

          <p>Columnas:</p>
          <ul>
            {response.stations.columns.map((col, index) =>(
              <li key={index}>{col}</li>
            ))}
          </ul>

          {/* Soluciones */}
          <h3>Soluciones</h3>
          {response.solutions.map((sol) => (
            <div key={sol.id} style={{marginBottom: "10px" }}>
              <p>ID: {sol.id}</p>
              <p>Objetivo 1: {sol.objective_1}</p>
              <p>Objetivo 2: {sol.objective_2}</p>
              <p>Estaciones generadas: {sol.stations_generated}</p>
              </div>
          ))}

        </div>
      )}
      <h2>Mapa base</h2>
      {/* Caja contenedora del mapa */}
      <div style={{ height: "500px", marginTop: "20px" }}>
        {/* Centro inicial del mapa, zoom inicial y cuanto ocupa de la caja */}
        <MapContainer
          center={[-30.0, -71.0]}
          zoom={4}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Recorro lista y por cada esatción se crea componente React */}
          {response && response.stations.items.map((station, index) => (
            <Marker
              key={index}
              position={[station.latitude, station.longitude]}
            >
              {/* Información de la estación */}
              <Popup>
                <div>
                  <p><strong>Estación:</strong> {station.station}</p>
                  <p><strong>ID:</strong> {station.id}</p>
                  <p><strong>Latitud:</strong> {station.latitude}</p>
                  <p><strong>Longitud:</strong> {station.longitude}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

    </div>
  )
}

export default App