
import { useState } from "react"
import { MapContainer, TileLayer, Marker, Popup , CircleMarker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { Group } from "@visx/group"
import { Circle } from "@visx/shape"
import { scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis" 
import L from "leaflet"

// Función para asignar colores a las soluciones según su frente de pareto
const getFrontColor = (front) => {
  if (front == 0) return "#e63946"
  if (front == 1) return "#1d4ed8"
  if (front == 2) return "#2a9d8f"
  if (front == 3) return "#9c0ecb"
  if (front == 4) return "#dde751"
  return "gray"
}

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

function App() {
  // Estados para almacenar los archivos, número de estaciones y respuesta del backend
  const [rasterFile, setRasterFile] = useState(null)
  const [stationsFile, setStationsFile] = useState(null)
  const [nStations, setNStations] = useState(0)
  const [nSolutions, setNSolutions] = useState(5)
  const [response, setResponse] = useState(null)
  const [selectedSolution, setSelectedSolution] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")
  
  // Manejo del envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    setErrorMessage("")

    if (!rasterFile) {
      setErrorMessage("Debe subir un archivo raster .geojson")
      return
    }

    if (!stationsFile) {
      setErrorMessage("Debe subir un archivo de estaciones .csv")
      return
    }

    if (!rasterFile.name.endsWith(".geojson")) {
      setErrorMessage("El archivo raster debe tener extensión .geojson")
      return
    }

    if (!stationsFile.name.endsWith(".csv")) {
      setErrorMessage("El archivo de estaciones debe tener extensión .csv")
      return
    }

    if (nStations <= 0) {
      setErrorMessage("El número de estaciones debe ser mayor que 0")
      return
    }

    if (nSolutions <= 0) {
      setErrorMessage("El número de soluciones debe ser mayor que 0")
      return
    }
    
    // Reiniciar solución seleccionada al enviar nuevo escenario
    setSelectedSolution(null)

    // Validación de archivos y número de estaciones
    const formData = new FormData()
    formData.append("raster_file", rasterFile)
    formData.append("stations_file", stationsFile)
    formData.append("n_stations", nStations)
    formData.append("n_solutions", nSolutions)
    // Envío de datos al endpoint scenario del backend
    try {
      const res = await fetch("http://localhost:8000/scenario", {
        method: "POST",
        body: formData
      })
      // Se obtiene la respuesta del backend y se maneja el caso de error
      const data = await res.json()
      // Si la respuesta no es ok, se muestra el mensaje de error enviado por el backend o un mensaje genérico
      if (!res.ok) {
        setErrorMessage(data.detail || "Ocurrió un error al procesar el escenario")
        return
      }
      // Si la respuesta es ok, se guarda la respuesta en el estado para mostrarla al usuario
      setResponse(data)

    } catch (error) {
      console.error(error)
    }
  }

  // Dimensiones y márgenes para la visualización de soluciones
  const chartWidth = 700
  const chartHeight = 400
  const margin = { top: 20, right: 30, bottom: 50, left: 60 }
  // Se extraen las soluciones de la respuesta, o se asigna lista vacía si no hay respuesta
  const solutions = response?.solutions || []

  // Convertir valores de datos a posiciones en pantalla usando escalas lineales
  const xScale = scaleLinear({
    domain: [0, 1],
    range: [margin.left, chartWidth - margin.right]
  })

  const yScale = scaleLinear({
    domain: [0, 1],
    range: [chartHeight - margin.bottom, margin.top]
  })

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

        <div>
          <label>Número de soluciones: </label>
          <input
            type="number"
            value={nSolutions}
            onChange={(e) => setNSolutions(e.target.value)}
          />
        </div>

        <button type="submit">Enviar</button>
      </form>

      {errorMessage && (
        <div style={{ color: "red", marginTop: "15px", fontWeight: "bold" }}>
          {errorMessage}
        </div>
      )}
      
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
              <p>Frente de Pareto: {sol.pareto_front}</p>
              <p>Estaciones generadas: {sol.new_stations.length}</p>
              </div>
          ))}

        </div>
      )}

      {response && (
        <div style={{ marginTop: "30px" }}>
          <h2>Frontera de Pareto</h2>
          {/* Se muestra al usario significado de cada color */}
          <div style={{ marginBottom: "10px "}}>
            <p><span style={{ color: "red", fontWeight: "bold" }}>●</span> Frente 0</p>
            <p><span style={{ color: "blue", fontWeight: "bold" }}>●</span> Frente 1</p>
            <p><span style={{ color: "green", fontWeight: "bold" }}>●</span> Frente 2</p>
            <p><span style={{ color: "purple", fontWeight: "bold" }}>●</span> Frente 3</p>
            <p><span style={{ color: "yellow", fontWeight: "bold" }}>●</span> Frente 4</p>
          </div>
          {/* Se crea el gráfico SVG para la frontera de Pareto */}
          <svg width={chartWidth} height={chartHeight} style={{ background: "white" }}>
            {/* Eje X */}
            <AxisBottom
              top={chartHeight - margin.bottom}
              scale={xScale}
              label="Homogeneidad espacial"
            />
            {/* Eje Y */}
            <AxisLeft
              left={margin.left}
              scale={yScale}
              label="Variabilidad del desplazamiento"
            />

            <Group>
              {/* Se recorren las soluciones para dibujar los puntos en el gráfico */}
              {solutions.map((solution) => (
                <g key={solution.id}>
                  {/* Punto en el gráfico */}
                  <Circle
                    cx={xScale(solution.objective_1)}
                    cy={yScale(solution.objective_2)}
                    /* Solución seleccionada tiene radio mayor */
                    r={selectedSolution?.id === solution.id ? 9 : 6}
                    fill={getFrontColor(solution.pareto_front)}
                    stroke={selectedSolution?.id === solution.id ? "black" : "black"}
                    /* Solución seleccionada tiene borde más grueso */
                    strokeWidth={selectedSolution?.id === solution.id ? 3 : 1}
                    style={{ cursor: "pointer" }}
                    /* Se guarda la solución seleccionada */
                    onClick={() => setSelectedSolution(solution)}
                  />
                  {/* Etiqueta para el punto */}
                  <text
                    x={xScale(solution.objective_1) + 8}
                    y={yScale(solution.objective_2) - 8}
                    fontSize={12}
                    fill="black"
                  >
                    {solution.id}
                  </text>
                </g>
              ))}
            </Group>
          </svg>
        </div>
      )}
      
      {/* Información de la solución seleccionada */}
      {selectedSolution && (
        <div style={{ marginTop: "20px" }}>
          <h3>Solución seleccionada</h3>
          <p>ID: {selectedSolution.id}</p>
          <p>Homogeneidad espacial: {selectedSolution.objective_1}</p>
          <p>Variabilidad del desplazamiento: {selectedSolution.objective_2}</p>
          <p>Frente de Pareto: {selectedSolution.pareto_front}</p>
          <p>Estaciones nuevas: {selectedSolution.new_stations.length}</p>

          <button onClick={() => setSelectedSolution(null)}>
            Cerrar selección
          </button>
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
          {/* Recorro lista y por cada estación se crea componente React */}
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
          {/* Marcadores para las nuevas estaciones, recorriendo las estaciones de la solución seleccionada */}
          {selectedSolution && selectedSolution.new_stations.map((station, index) => (
            <Marker
              key={'new-${selectedSolution.id}-${index}}'}
              position={[station.latitude, station.longitude]}
              icon={redIcon}
            >
              <Popup>
                <div>
                  <p><strong>Solución:</strong> {selectedSolution.id}</p>
                  <p><strong>Nueva estación:</strong> {station.station}</p>
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