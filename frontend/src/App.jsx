
import { useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup , CircleMarker, GeoJSON } from "react-leaflet"
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
  const [algorithms, setAlgorithms] = useState([])
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("")
  const [algorithmParams, setAlgorithmParams] = useState({})
  const [showExistingStations, setShowExistingStations] = useState(true)
  const [showNewStations, setShowNewStations] = useState(true)
  const [showBaseMap, setShowBaseMap] = useState(true)
  const [showRasterLayer, setShowRasterLayer] = useState(true)  
  const [tooltipSolution, setTooltipSolution] = useState(null) 
  const [visibleFronts, setVisibleFronts] = useState({})

  // Se obtiene el catálogo de algoritmos disponibles al cargar la aplicación
  useEffect(() => {
    fetch("http://localhost:8000/algorithms")
      .then((res) => res.json())
      .then((data) => {
        setAlgorithms(data.algorithms)
      })
      .catch((error) => {
        console.error(error)
      })
  }, [])

  // Se obtiene el algoritmo seleccionado del catálogo para mostrar sus parámetros
  const currentAlgorithm = algorithms.find(
    (algorithm) => algorithm.id === selectedAlgorithm
  )
  
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
    // Se agregan al formData el algoritmo seleccionado y sus parámetros, convirtiendo estos últimos a JSON para enviarlos como string
    formData.append("algorithm", selectedAlgorithm)
    formData.append("algorithm_params", JSON.stringify(algorithmParams))
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
  const chartWidth = 850
  const plotWidth = 700
  const chartHeight = 400
  const margin = { top: 20, right: 30, bottom: 50, left: 60 }
  // Se extraen las soluciones de la respuesta, o se asigna lista vacía si no hay respuesta
  const solutions = response?.solutions || []

  // Se obtiene la lista de frentes de pareto disponibles en las soluciones para mostrar opciones de filtrado
  const availableFronts = [
    ...new Set(solutions.map((solution) => solution.pareto_front))
  ].sort((a, b) => a - b)

  // Se filtran las soluciones según los frentes de pareto visibles, utilizando el estado visibleFronts para determinar qué frentes mostrar
  const filteredSolutions = solutions.filter((solution) => {
    return visibleFronts[solution.pareto_front] !== false
  })

  // Función para alternar la visibilidad de un frente de pareto específico, 
  // actualizando el estado visibleFronts para mostrar u ocultar las soluciones correspondientes
  const toggleFront = (front) => {
    setVisibleFronts((prev) => ({
      ...prev,
      [front]: prev[front] === false ? true : false
    }))
  }

  // Convertir valores de datos a posiciones en pantalla usando escalas lineales
  const xScale = scaleLinear({
    domain: [0, 1],
    range: [margin.left, plotWidth - margin.right]
  })

  const yScale = scaleLinear({
    domain: [0, 1],
    range: [chartHeight - margin.bottom, margin.top]
  })

  {/* Posición tooltip */}
  const tooltipX = tooltipSolution
    ? xScale(tooltipSolution.objective_1)
    : 0

  const tooltipY = tooltipSolution
    ? yScale(tooltipSolution.objective_2)
    : 0

  const adjustedTooltipY =
    tooltipY < 90 ? tooltipY + 20 : tooltipY - 70

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
          <label>Algoritmo:</label>

          <select
            value={selectedAlgorithm}
            onChange={(e) => setSelectedAlgorithm(e.target.value)}
          >
            <option value="">Seleccione un algoritmo</option>

            {algorithms.map((algorithm) => (
              <option key={algorithm.id} value={algorithm.id}>
                {algorithm.name}
              </option>
            ))}
          </select>
        </div>

        {currentAlgorithm && (
          <div>
            <h3>Parámetros de {currentAlgorithm.name}</h3>

            {currentAlgorithm.parameters.map((param) => (
              <div key={param.name}>
                <label>{param.label}: </label>
                <input
                  type={param.type}
                  defaultValue={param.default}
                  min={param.min}
                  max={param.max}
                  onChange={(e) =>
                    setAlgorithmParams({
                      ...algorithmParams,
                      [param.name]: e.target.value
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}

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
      
      {currentAlgorithm && (
        <div>
          <h3>Algoritmo utilizado</h3>
          <p>{currentAlgorithm.name}</p>

          <h4>Parámetros enviados</h4>
          <ul>
            {currentAlgorithm.parameters.map((param) => (
              <li key={param.name}>
                {param.label}: {algorithmParams[param.name] ?? param.default}
              </li>
            ))}
          </ul>
        </div>
      )}

      {response && (
        <div style={{ marginTop: "30px" }}>
          <h2>Frontera de Pareto</h2>
          {/* Se crea el gráfico SVG para la frontera de Pareto */}
          <svg width={chartWidth} height={chartHeight} style={{ background: "white" }}>
            <foreignObject x={plotWidth + 10} y={40} width={130} height={180}>
              <div
                style={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid #999",
                  borderRadius: "8px",
                  padding: "8px",
                  color: "black",
                  fontSize: "13px",
                  maxHeight: "145px",
                  overflowY: "auto"
                }}
              >
                <strong>Frentes</strong>

                {availableFronts.map((front) => (
                  <label
                    key={front}
                    style={{
                      display: "block",
                      marginTop: "6px",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleFronts[front] !== false}
                      onChange={() => toggleFront(front)}
                    />

                    <span
                      style={{
                        color: getFrontColor(front),
                        fontWeight: "bold",
                        marginLeft: "6px"
                      }}
                    >
                      ●
                    </span>

                    {" "}Frente {front}
                  </label>
                ))}
              </div>
            </foreignObject>
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
              {filteredSolutions.map((solution) => (
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
                    onMouseEnter={() => setTooltipSolution(solution)}
                    onMouseLeave={() => setTooltipSolution(null)}
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
              
              {/* Tooltip */}
              {tooltipSolution && (
                <g>
                  <rect
                    // Posición del tooltip, ajustada para que no quede encima del punto
                    x={tooltipX + 12}
                    y={adjustedTooltipY}
                    // Dimensiones del tooltip
                    width={190}
                    height={90}
                    fill="white"
                    stroke="black"
                    rx={6}
                  />

                  <text
                  // Posición del texto dentro del tooltip, ajustada para que quede dentro del rectángulo
                    x={tooltipX + 22}
                    y={adjustedTooltipY + 20}
                    fill="black"
                    fontSize={12}
                  >
                    Solución: {tooltipSolution.id}
                  </text>

                  <text
                    x={tooltipX + 22}
                    y={adjustedTooltipY + 38}
                    fill="black"
                    fontSize={12}
                  >
                    Homogeneidad: {tooltipSolution.objective_1}
                  </text>

                  <text
                    x={tooltipX + 22}
                    y={adjustedTooltipY + 56}
                    fill="black"
                    fontSize={12}
                  >
                    Variabilidad: {tooltipSolution.objective_2}
                  </text>

                  <text
                    x={tooltipX + 22}
                    y={adjustedTooltipY + 74}
                    fill="black"
                    fontSize={12}
                  >
                    Frente: {tooltipSolution.pareto_front}
                  </text>
                </g>
              )}
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
      <div style={{ height: "600px", width: "100%", position: "relative" }}>
        {response && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              zIndex: 1000,
              backgroundColor: "rgba(255,255,255,0.95)",
              padding: "10px",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              color: "black",
              minWidth: "180px"
            }}
          >
            <h4 style={{ marginTop: 0 }}>Capas</h4>

            <label>
              <input
                type="checkbox"
                checked={showBaseMap}
                onChange={() => setShowBaseMap(!showBaseMap)}
              />
              Mapa base
            </label>

            <br />

            <label>
              <input
                type="checkbox"
                checked={showExistingStations}
                onChange={() => setShowExistingStations(!showExistingStations)}
              />
              Estaciones existentes
            </label>

            <br />

            <label>
              <input
                type="checkbox"
                checked={showNewStations}
                onChange={() => setShowNewStations(!showNewStations)}
              />
              Estaciones nuevas
            </label>

            <br />

            <label>
              <input
                type="checkbox"
                checked={showRasterLayer}
                onChange={() => setShowRasterLayer(!showRasterLayer)}
              />
              Raster / GeoJSON
            </label>
          </div>
        )}
        {/* Centro inicial del mapa, zoom inicial y cuanto ocupa de la caja */}
        <MapContainer
          center={[-30.0, -71.0]}
          zoom={4}
          style={{ height: "100%", width: "100%" }}
        >
          {showBaseMap && (
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          {/* Capa de raster / GeoJSON */}
          {showRasterLayer && response?.raster?.geojson && (
            <GeoJSON
              data={response.raster.geojson}
              // Se asignan colores a cada celca del GeoJSON según el valor de la propiedad valor_centroide,
              //  utilizando una escala de colores de bajo a alto
              style={(feature) => {
                const value = feature.properties.valor_centroide

                let fillColor = "#2c7bb6" // bajo

                if (value >=2.0){
                  fillColor = "#d7191c" // alto
                } else if (value >=1.5){
                  fillColor = "#fdae61" // medio-alto
                } else if (value >=1.0){
                  fillColor = "#ffffbf" // medio
                } else if (value >=0.5){
                  fillColor = "#a6d96a" // medio-bajo
              }
              // Se retorna el estilo para cada celda del GeoJSON, con el color de relleno asignado 
              // y una opacidad para que se vea el mapa base debajo
              return {
                color: fillColor,
                weight: 0.2,
                fillColor: fillColor,
                fillOpacity: 0.45
              }
            }}
            />
          )}
          {/* Marcadores para las estaciones existentes */}
          {showExistingStations && response && response.stations.items.map((station, index) => (
            <Marker
              key={`existing-${index}`}
              position={[station.latitude, station.longitude]}
            >
              <Popup>
                <div>
                  <p><strong>Estación existente:</strong> {station.station}</p>
                  <p><strong>ID:</strong> {station.id}</p>
                  <p><strong>Latitud:</strong> {station.latitude}</p>
                  <p><strong>Longitud:</strong> {station.longitude}</p>
                </div>
              </Popup>
            </Marker>
          ))}
          {/* Marcadores para las nuevas estaciones, recorriendo las estaciones de la solución seleccionada */}
          {showNewStations && selectedSolution && selectedSolution.new_stations.map((station, index) => (
            <Marker
              key={`new-${selectedSolution.id}-${index}`}
              position={[station.latitude, station.longitude]}
              icon={redIcon}
            >
              <Popup>
                <div>
                  <p><strong>Solución:</strong> {selectedSolution.id}</p>
                  <p><strong>Nueva estación:</strong></p>
                  <p><strong>ID:</strong> {station.id}</p>
                  <p><strong>Latitud:</strong> {station.latitude}</p>
                  <p><strong>Longitud:</strong> {station.longitude}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {/* Leyenda de la capa de raster */}
        {showRasterLayer && response?.raster?.geojson && (
          <div 
            style={{ 
              position: "absolute",
              bottom: "20px",
              right: "20px",
              zIndex: 1000,
              background: "white",
              padding: "10px",
              borderRdius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              color: "black",
              fronSize: "14px",
              }}
            >
            <strong>Escala de colores</strong>
            <span style={{ color: "#2c7bb6", frontWeight: "bold"}}>■</span> Bajo&nbsp;&nbsp;
            <span style={{ color: "#a6d96a", frontWeight: "bold"}}>■</span> Medio-bajo&nbsp;&nbsp;
            <span style={{ color: "#ffffbf", frontWeight: "bold"}}>■</span> Medio&nbsp;&nbsp;
            <span style={{ color: "#fdae61", frontWeight: "bold"}}>■</span> Medio-alto&nbsp;&nbsp;
            <span style={{ color: "#d7191c", frontWeight: "bold"}}>■</span> Alto
        </div>
        )}
      </div>
    </div>
  )
}

export default App