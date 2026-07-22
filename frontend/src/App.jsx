
import { useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup , CircleMarker, GeoJSON, LayersControl, LayerGroup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { Group } from "@visx/group"
import { Circle } from "@visx/shape"
import { scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis" 
import L from "leaflet"

// Dirección base del backend.
// En desarrollo usa localhost y, al desplegarse, utiliza VITE_API_URL.
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "")

// Función para asignar colores a las soluciones según su frente de pareto
const getFrontColor = (front) => {
  if (front == 0) return "#e63946"
  if (front == 1) return "#1d4ed8"
  if (front == 2) return "#2a9d8f"
  if (front == 3) return "#9c0ecb"
  if (front == 4) return "#eb7310"
  if (front == 5) return "#364725"
  if (front == 6) return "rgb(252, 64, 208)"
  if (front == 7) return "#a41623"
  if (front == 8) return "#457b9d"
  if (front == 9) return "#ffb703"
  if (front == 10) return "#8ecae6"
  return "gray"
}

// Icono personalizado para las estaciones nuevas, utilizando un triángulo invertido de color azul
const triangleIcon = L.divIcon({
  className: "triangle-marker",
  html: `
    <div style="
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 16px solid #1d4ed8;
    "></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 16],
  popupAnchor: [0, -16]
})

const getRasterColor = (value) => {
  if (value >= 2.0) return "#d7191c"
  if (value >= 1.5) return "#fdae61"
  if (value >= 1.0) return "#ffffbf"
  if (value >= 0.5) return "#abd9e9"
  return "#2c7bb6"
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
  const [seed, setSeed] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Se obtiene el catálogo de algoritmos disponibles al cargar la aplicación
  useEffect(() => {
    fetch(`${API_BASE_URL}/algorithms`)
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

  // Convierte los distintos formatos de error del backend
  // en un mensaje de texto que React pueda mostrar.
  const formatApiError = (detail) => {
    if (typeof detail === "string") {
      return detail
    }

    if (Array.isArray(detail)) {
      return detail
        .map((error) => {
          const field = Array.isArray(error.loc)
            ? error.loc[error.loc.length - 1]
            : null

          return field
            ? `${field}: ${error.msg}`
            : error.msg
        })
        .join(" | ")
    }

    return "Ocurrió un error al procesar el escenario."
  }
  
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

    if (!selectedAlgorithm) {
    setErrorMessage("Debe seleccionar un algoritmo de prueba.")
    return
    }

    if (Number(nStations) <= 0) {
      setErrorMessage("El número de estaciones debe ser mayor que 0")
      return
    }

    if (Number(nSolutions) <= 0) {
      setErrorMessage("El número de soluciones debe ser mayor que 0")
      return
    }
    
    // Reiniciar solución seleccionada al enviar nuevo escenario
    setSelectedSolution(null)

    // Reiniciar estado de carga y respuesta al enviar nuevo escenario
    setIsLoading(true)
    setResponse(null)

    // Validación de archivos y número de estaciones
    const formData = new FormData()
    formData.append("raster_file", rasterFile)
    formData.append("stations_file", stationsFile)
    formData.append("n_stations", nStations)
    formData.append("n_solutions", nSolutions)

    // Se agrega la semilla al formData solo si no está vacía
    if (seed !== "") {
      formData.append("seed", seed)
    }

    // Se agregan al formData el algoritmo seleccionado y sus parámetros, convirtiendo estos últimos a JSON para enviarlos como string
    formData.append("algorithm", selectedAlgorithm)
    formData.append("algorithm_params", JSON.stringify(algorithmParams))
    // Envío de datos al endpoint scenario del backend
    try {

      const startRequest = performance.now()

      const res = await fetch(`${API_BASE_URL}/scenario`, {
        method: "POST",
        body: formData
      })
      // Se obtiene la respuesta del backend y se maneja el caso de error
      const data = await res.json()
      // Si la respuesta no es ok, se muestra el mensaje de error enviado por el backend o un mensaje genérico
      if (!res.ok) {
        setErrorMessage(formatApiError(data.detail))
        return
      }

      const endRequest = performance.now()
      console.log(
        "Tiempo total frontend request:",
        ((endRequest - startRequest) / 1000).toFixed(4),
        "segundos"
      )
      console.log("Performance backend:", data.performance)
      // Si la respuesta es ok, se guarda la respuesta en el estado para mostrarla al usuario
      setResponse(data)

    } catch (error) {
      console.error(error)

      setErrorMessage("No fue posible conectar con el servidor. Verifique que el backend este en ejecución")

    } finally {
      setIsLoading(false)
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

  // Muestra permanentemente los identificadores cuando existen pocas soluciones.
  // Si existen muchas, solo se muestra el identificador de la solución seleccionada.
  const showSolutionLabels = filteredSolutions.length <= 15

  // Función para alternar la visibilidad de un frente de pareto específico, 
  // actualizando el estado visibleFronts para mostrar u ocultar las soluciones correspondientes
  const toggleFront = (front) => {
    setVisibleFronts((prev) => ({
      ...prev,
      [front]: prev[front] === false ? true : false
    }))
  }

  // Activa la visualización de todos los frentes disponibles.
  const showAllFronts = () => {
    const allFrontsVisible = {}

    availableFronts.forEach((front) => {
      allFrontsVisible[front] = true
    })

    setVisibleFronts(allFrontsVisible)
  }


  // Muestra únicamente las soluciones pertenecientes al frente 0.
  const showOnlyFrontZero = () => {
    const onlyFrontZeroVisible = {}

    availableFronts.forEach((front) => {
      onlyFrontZeroVisible[front] = front === 0
    })

    setVisibleFronts(onlyFrontZeroVisible)

    // Evita mantener seleccionada una solución que quedará oculta.
    if (selectedSolution?.pareto_front !== 0) {
      setSelectedSolution(null)
    }
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

  // ----------------- ESTILO FORMULARIO ------------------------------
  
  // Estilos para el formulario y secciones
  const formStyle = {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "24px",
    border: "1px solid #3f4654",
    borderRadius: "12px",
    background: "#181b22"
  }

  // Estilos para las secciones del formulario, incluyendo borde, padding y margen inferior
  const sectionStyle = {
    border: "1px solid #3f4654",
    borderRadius: "10px",
    padding: "18px",
    marginBottom: "18px"
  }

  // Estilos para los títulos de las secciones del formulario, incluyendo padding, font-weight y tamaño de fuente
  const legendStyle = {
    padding: "0 10px",
    fontWeight: "bold",
    fontSize: "18px"
  }

  // Estilos para las filas de campos del formulario, utilizando grid layout para alinear etiquetas y controles, con gap y margen inferior
  const fieldRowStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(200px, 260px) minmax(240px, 1fr)",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
    textAlign: "left"
  }

  // Estilos para los controles de entrada del formulario, asegurando que ocupen todo el ancho disponible y tengan box-sizing border-box para incluir padding y borde en el tamaño total
  const controlStyle = {
    width: "100%",
    boxSizing: "border-box"
  }

  // Estilos para la tarjeta de resultados, incluyendo ancho máximo, margen, padding, borde, radio de borde y fondo
  const resultCardStyle = {
  maxWidth: "900px",
  margin: "30px auto",
  padding: "24px",
  border: "1px solid #3f4654",
  borderRadius: "12px",
  background: "#181b22"
}

// ----------------- ESTILO RESUMEN ------------------------------

// Estilos para el grid de resumen, utilizando grid layout con columnas automáticas y gap entre
const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
  marginTop: "20px"
}

// Estilos para cada ítem del resumen, incluyendo padding, borde, radio
const summaryItemStyle = {
  padding: "14px",
  border: "1px solid #3f4654",
  borderRadius: "8px",
  textAlign: "left"
}

// Estilos para las etiquetas de los ítems del resumen, incluyendo tamaño de fuente, opacidad y margen inferior
const summaryLabelStyle = {
  display: "block",
  fontSize: "14px",
  opacity: 0.75,
  marginBottom: "5px"
}

// Estilos para los valores de los ítems del resumen, incluyendo font-weight y overflow
const summaryValueStyle = {
  fontWeight: "bold",
  overflowWrap: "anywhere"
}

// ----------------- ESTILO VISUALIZACIÓN DE SOLUCIONES ------------------------------

// Estilos para la sección de visualización de soluciones, incluyendo ancho máximo, margen, padding, borde, radio de borde y fondo
const visualizationSectionStyle = {
  maxWidth: "1200px",
  margin: "30px auto",
  padding: "24px",
  border: "1px solid #3f4654",
  borderRadius: "12px",
  background: "#181b22"
}

// Estilos para el contenedor del gráfico de soluciones, incluyendo margen superior, overflow horizontal, fondo, radio de borde y padding
const chartContainerStyle = {
  marginTop: "20px",
  overflowX: "auto",
  background: "white",
  borderRadius: "10px",
  padding: "12px",
  width: "100%",
  boxSizing: "border-box"
}

// Estilos para la tarjeta de la solución seleccionada, incluyendo margen superior, padding, borde, radio de borde y fondo
const selectedSolutionCardStyle = {
  marginTop: "20px",
  padding: "20px",
  border: "1px solid #3f4654",
  borderRadius: "10px",
  background: "#15181f"
}

// ----------------- ESTILO MAPA ------------------------------

// Estilos para la sección del mapa, incluyendo ancho máximo, margen, padding, borde, radio de borde y fondo
const mapSectionStyle = {
  maxWidth: "1200px",
  margin: "30px auto",
  padding: "24px",
  border: "1px solid #3f4654",
  borderRadius: "12px",
  background: "#181b22"
}

  return (
    <div style={{ padding: "20px" }}>
      <h1>GNSS Optimización</h1>

      <form onSubmit={handleSubmit} style={formStyle}>
        <h2 style={{ marginTop: 0 }}>Configuración del escenario</h2>

        {/* Sección 1: archivos de entrada */}
        <fieldset style={sectionStyle}>
          <legend style={legendStyle}>1. Datos de entrada</legend>

          <div style={fieldRowStyle}>
            <label htmlFor="raster-file">
              Raster GeoJSON:
            </label>

            <input
              id="raster-file"
              type="file"
              accept=".geojson,application/geo+json"
              onChange={(e) => setRasterFile(e.target.files[0])}
              style={controlStyle}
            />
          </div>

          <div style={fieldRowStyle}>
            <label htmlFor="stations-file">
              Estaciones CSV:
            </label>

            <input
              id="stations-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setStationsFile(e.target.files[0])}
              style={controlStyle}
            />
          </div>
        </fieldset>

        {/* Sección 2: algoritmo y parámetros */}
        <fieldset style={sectionStyle}>
          <legend style={legendStyle}>2. Algoritmo de prueba</legend>

          <div style={fieldRowStyle}>
            <label htmlFor="algorithm-select">
              Algoritmo:
            </label>

            <select
              id="algorithm-select"
              value={selectedAlgorithm}
              onChange={(e) => {
                setSelectedAlgorithm(e.target.value)
                setAlgorithmParams({})
                setErrorMessage("")
              }}
              style={controlStyle}
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
            <div
              style={{
                marginTop: "18px",
                paddingTop: "16px",
                borderTop: "1px solid #3f4654"
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                Parámetros de {currentAlgorithm.name}
              </h3>

              {currentAlgorithm.parameters.map((param) => (
                <div key={param.name} style={fieldRowStyle}>
                  <label htmlFor={`param-${param.name}`}>
                    {param.label}:
                  </label>

                  <input
                    id={`param-${param.name}`}
                    type={param.type}
                    value={algorithmParams[param.name] ?? param.default}
                    min={param.min}
                    max={param.max}
                    step={param.step ?? 1}
                    onChange={(e) =>
                      setAlgorithmParams((previousParams) => ({
                        ...previousParams,
                        [param.name]: e.target.value
                      }))
                    }
                    style={controlStyle}
                  />
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {/* Sección 3: configuración general */}
        <fieldset style={sectionStyle}>
          <legend style={legendStyle}>3. Configuración del escenario</legend>

          <div style={fieldRowStyle}>
            <label htmlFor="n-stations">
              Número de estaciones nuevas:
            </label>

            <input
              id="n-stations"
              type="number"
              min="1"
              value={nStations}
              onChange={(e) => setNStations(e.target.value)}
              style={controlStyle}
            />
          </div>

          <div style={fieldRowStyle}>
            <label htmlFor="n-solutions">
              Número de soluciones:
            </label>

            <input
              id="n-solutions"
              type="number"
              min="1"
              value={nSolutions}
              onChange={(e) => setNSolutions(e.target.value)}
              style={controlStyle}
            />
          </div>

          <details style={{ marginTop: "16px" }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: "bold",
                textAlign: "left"
              }}
            >
              Opciones avanzadas
            </summary>

            <div style={{ ...fieldRowStyle, marginTop: "16px" }}>
              <label htmlFor="scenario-seed">
                Semilla de reproducibilidad:
              </label>

              <input
                id="scenario-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Ejemplo: 42"
                style={controlStyle}
              />
            </div>

            <p
              style={{
                fontSize: "14px",
                textAlign: "left",
                marginBottom: 0,
                opacity: 0.8
              }}
            >
              Utilice la misma semilla para reproducir un escenario con
              los mismos datos y parámetros.
            </p>
          </details>
        </fieldset>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: "10px 22px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        >
          {isLoading ? "Generando escenario..." : "Generar escenario"}
        </button>
      </form>

      {!response && (
        <div
          style={{
            marginTop: "30px",
            padding: "24px",
            border: "1px solid #3f4654",
            borderRadius: "10px",
            maxWidth: "700px",
            marginLeft: "auto",
            marginRight: "auto"
          }}
        >
          <h2 style={{ marginTop: 0 }}>Configure un escenario</h2>

          <p style={{ marginBottom: 0 }}>
            Cargue los archivos requeridos, seleccione un algoritmo de prueba
            y defina la cantidad de estaciones y soluciones para visualizar
            los resultados.
          </p>
        </div>
      )}

      {errorMessage && (
        <div style={{ color: "red", marginTop: "15px", fontWeight: "bold" }}>
          {errorMessage}
        </div>
      )}

      {response && (
        <section style={resultCardStyle}>
          <h2 style={{ marginTop: 0 }}>Resultado del escenario</h2>

          <div style={summaryGridStyle}>
            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>Algoritmo</span>
              <span style={summaryValueStyle}>
                {response.scenario.algorithm}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>Soluciones generadas</span>
              <span style={summaryValueStyle}>
                {response.scenario.n_solutions}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>Estaciones por solución</span>
              <span style={summaryValueStyle}>
                {response.scenario.n_stations}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>Estaciones existentes</span>
              <span style={summaryValueStyle}>
                {response.stations.total}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>Elementos del raster</span>
              <span style={summaryValueStyle}>
                {response.raster.features_count}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>Semilla utilizada</span>
              <span style={summaryValueStyle}>
                {response.scenario.seed ?? "Aleatoria"}
              </span>
            </div>
          </div>

          <details
            style={{
              marginTop: "20px",
              textAlign: "left"
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Ver detalles del escenario
            </summary>

            <div style={{ marginTop: "15px" }}>
              <p>
                <strong>Raster:</strong>{" "}
                {response.scenario.raster_filename}
              </p>

              <p>
                <strong>Archivo de estaciones:</strong>{" "}
                {response.scenario.stations_filename}
              </p>

              <p>
                <strong>Tipo GeoJSON:</strong>{" "}
                {response.raster.geojson_type}
              </p>

              <p>
                <strong>CRS informado:</strong>{" "}
                {response.raster.has_crs ? "Sí" : "No"}
              </p>

              <strong>Parámetros del algoritmo:</strong>

              <ul>
                {Object.entries(
                  response.scenario.algorithm_params || {}
                ).map(([parameterName, parameterValue]) => (
                  <li key={parameterName}>
                    {parameterName}: {parameterValue}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </section>
      )}

      {response && (
        <section style={visualizationSectionStyle}>
          <h2 style={{ marginTop: 0 }}>
            Exploración de soluciones
          </h2>

          <p>
            Seleccione un punto del gráfico para visualizar sus valores
            y las estaciones propuestas en el mapa.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "16px",
              marginBottom: "16px"
            }}
          >
            <button
              type="button"
              onClick={showAllFronts}
              style={{
                padding: "8px 14px",
                cursor: "pointer"
              }}
            >
              Mostrar todos los frentes
            </button>

            <button
              type="button"
              onClick={showOnlyFrontZero}
              style={{
                padding: "8px 14px",
                cursor: "pointer"
              }}
            >
              Mostrar solo frente 0
            </button>
          </div>

          <div style={chartContainerStyle}>
            <svg
              width={chartWidth}
              height={chartHeight}
              style={{
                display: "block",
                width: `${chartWidth}px`,
                height: `${chartHeight}px`,
                minWidth: `${chartWidth}px`,
                maxWidth: "none",
                margin: "0 auto"
              }}
            >
          {/* Se crea el gráfico SVG para la frontera de Pareto */}
            {/* Controles para los frentes de Pareto */}
            {/* Posición y tamaño del panel de controles */}
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
                {/* Recorre todos los frentes existentes y contenedor visual */}
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
                  {(showSolutionLabels || selectedSolution?.id === solution.id) && (
                    <text
                      x={xScale(solution.objective_1) + 8}
                      y={yScale(solution.objective_2) - 8}
                      fontSize={12}
                      fontWeight={
                        selectedSolution?.id === solution.id ? "bold" : "normal"
                      }
                      fill="black"
                    >
                      {solution.id}
                    </text>
                  )}
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
     {selectedSolution ? (
        <div style={selectedSolutionCardStyle}>
          <h3 style={{ marginTop: 0 }}>
            Solución seleccionada
          </h3>

          <div style={summaryGridStyle}>
            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>
                Identificador
              </span>
              <span style={summaryValueStyle}>
                Solución {selectedSolution.id}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>
                Homogeneidad espacial
              </span>
              <span style={summaryValueStyle}>
                {selectedSolution.objective_1}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>
                Variabilidad del desplazamiento
              </span>
              <span style={summaryValueStyle}>
                {selectedSolution.objective_2}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>
                Frente de Pareto
              </span>
              <span style={summaryValueStyle}>
                {selectedSolution.pareto_front}
              </span>
            </div>

            <div style={summaryItemStyle}>
              <span style={summaryLabelStyle}>
                Estaciones propuestas
              </span>
              <span style={summaryValueStyle}>
                {selectedSolution.new_stations.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedSolution(null)}
            style={{
              marginTop: "18px",
              padding: "8px 16px",
              cursor: "pointer"
            }}
          >
            Quitar selección
          </button>
        </div>
      ) : (
        <div style={selectedSolutionCardStyle}>
          <h3 style={{ marginTop: 0 }}>
            Ninguna solución seleccionada
          </h3>

          <p style={{ marginBottom: 0 }}>
            Seleccione un punto de la frontera de Pareto para consultar
            sus valores y mostrar sus estaciones propuestas en el mapa.
          </p>
        </div>
      )}
    </section>
  )}
      {response && (
        <section style={mapSectionStyle}>
          <h2 style={{ marginTop: 0 }}>
            Visualización geoespacial
          </h2>

          <p>
            {selectedSolution
              ? `El mapa muestra las estaciones propuestas por la solución ${selectedSolution.id}, junto con las estaciones existentes y el raster de referencia.`
              : "Seleccione una solución en el gráfico de Pareto para visualizar sus estaciones propuestas en el mapa."}
          </p>

          <div
            style={{
              height: "600px",
              width: "100%",
              position: "relative",
              marginTop: "20px",
              borderRadius: "10px",
              overflow: "hidden"
            }}
          >
          {/* Centro inicial del mapa, zoom inicial y cuanto ocupa de la caja */}
          <MapContainer
            center={[-30.0, -71.0]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
          >
            <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Mapa base">
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
              {/* Capa de raster / GeoJSON */}
              <LayersControl.Overlay checked name="Raster / GeoJSON">
                <LayerGroup>
                  {response?.raster?.geojson && (
                    <GeoJSON
                      data={response.raster.geojson}
                      style={(feature) => {
                        const value = feature.properties.valor_centroide
                        const fillColor = getRasterColor(value)

                        return {
                          color: fillColor,
                          weight: 0.2,
                          fillColor: fillColor,
                          fillOpacity: 0.45
                        }
                      }}
                    />
                  )}
                </LayerGroup>
              </LayersControl.Overlay>
              {/* Marcadores para las estaciones existentes */}
              <LayersControl.Overlay checked name="Estaciones existentes">
                <LayerGroup>
                  {response &&
                    response.stations.items.map((station, index) => (
                      <Marker
                        key={`existing-${index}`}
                        position={[station.latitude, station.longitude]}
                        icon={triangleIcon}
                      >
                        <Popup>
                          <div>
                            <p><strong>ID:</strong> {station.id}</p>
                            <p><strong>Latitud:</strong> {station.latitude}</p>
                            <p><strong>Longitud:</strong> {station.longitude}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                </LayerGroup>
              </LayersControl.Overlay>
              {/* Marcadores para las nuevas estaciones, recorriendo las estaciones de la solución seleccionada */}
              <LayersControl.Overlay checked name="Estaciones nuevas">
                <LayerGroup>
                  {selectedSolution &&
                    selectedSolution.new_stations.map((station, index) => (
                      <Marker
                        key={`new-${selectedSolution.id}-${index}`}
                        position={[station.latitude, station.longitude]}
                        icon={redIcon}
                      >
                        <Popup>
                          <div>
                            <p><strong>Solución:</strong> {selectedSolution.id}</p>
                            <p><strong>ID:</strong> {station.id}</p>
                            <p><strong>Latitud:</strong> {station.latitude}</p>
                            <p><strong>Longitud:</strong> {station.longitude}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                </LayerGroup>
              </LayersControl.Overlay>
            </LayersControl>
          </MapContainer>
        </div>
        <div
          style={{
            marginTop: "18px",
            padding: "16px",
            border: "1px solid #3f4654",
            borderRadius: "10px",
            textAlign: "left"
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "14px" }}>
            Leyenda del mapa
          </h3>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "20px",
              alignItems: "center",
              marginBottom: "16px"
            }}
          >
            {/* Símbolo de estación existente */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "7px solid transparent",
                  borderRight: "7px solid transparent",
                  borderBottom: "14px solid #1d4ed8"
                }}
              />

              <span>Estación GNSS existente</span>
            </div>

            {/* Símbolo de estación nueva */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: "#e63946",
                  border: "2px solid #9f1239",
                  display: "inline-block"
                }}
              />

              <span>Estación propuesta</span>
            </div>
          </div>

          <div>
            <strong>Escala del raster:</strong>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
                marginTop: "10px"
              }}
            >
              {[
                { label: "Bajo", color: "#2c7bb6" },
                { label: "Medio-bajo", color: "#abd9e9" },
                { label: "Medio", color: "#ffffbf" },
                { label: "Medio-alto", color: "#fdae61" },
                { label: "Alto", color: "#d7191c" }
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      background: item.color,
                      border: "1px solid #777",
                      display: "inline-block"
                    }}
                  />

                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </section>
      )}
    </div>
  )
}

export default App