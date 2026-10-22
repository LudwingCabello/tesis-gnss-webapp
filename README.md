# GNSS Optimización

Prototipo de aplicación web desarrollado como parte de un trabajo de titulación para la exploración y visualización de escenarios de densificación de redes de estaciones GNSS mediante soluciones multiobjetivo simuladas.

## Descripción y alcance

La aplicación permite cargar un archivo CSV de estaciones GNSS existentes y una capa geoespacial contextual en formato GeoJSON; configurar un escenario; generar soluciones de prueba; clasificarlas en frentes de Pareto; y explorar sus valores objetivo y estaciones propuestas mediante un gráfico interactivo y un mapa.

**Alcance y limitaciones:**

- Las coordenadas propuestas y los valores objetivo de cada solución se generan de forma pseudoaleatoria para fines de prueba. No se calculan a partir de series de desplazamiento GNSS.
- NSGA-II y MOSA aparecen como alternativas simuladas de configuración. Sus parámetros se muestran y validan, pero no ejecutan esos algoritmos ni determinan los valores objetivo o las coordenadas propuestas.
- La clasificación por dominancia de Pareto **sí está implementada**: se calcula sobre las soluciones simuladas, considerando la maximización de ambos valores objetivo.
- El archivo GeoJSON de prueba contiene polígonos derivados de un ráster y se utiliza para comprobar su carga y visualización en el mapa. Sus atributos no representan mediciones de variabilidad del desplazamiento GNSS ni intervienen en la generación de los valores objetivo o de las ubicaciones simuladas.
- Las estaciones propuestas no deben interpretarse como ubicaciones óptimas ni como resultados de una validación geodésica.

## Tecnologías

- **Interfaz web:** React, Vite, React-Leaflet/Leaflet y VisX.
- **API y procesamiento:** Python, FastAPI y Uvicorn.
- **Ejecución local:** Docker y Docker Compose.
- **Archivos de entrada:** CSV y GeoJSON.

## Requisitos para ejecutar localmente

Se necesita Docker Engine o Docker Desktop con Docker Compose V2, un navegador web y conexión a Internet para descargar imágenes y dependencias durante la primera construcción. Git es necesario si se obtendrá el proyecto mediante `git clone`.

En Windows puede utilizarse Docker Desktop con contenedores Linux. No es necesario instalar Python ni Node.js localmente: el backend utiliza la imagen `python:3.11-slim` y el frontend la imagen `node:20`.

Las instrucciones suponen que los puertos locales `8000` y `5173` están disponibles. El mapa base de OpenStreetMap requiere conexión a Internet para cargar sus teselas.

## Obtener el código

Desde una terminal:

```bash
git clone https://github.com/LudwingCabello/tesis-gnss-webapp.git
cd tesis-gnss-webapp
```

Todos los comandos siguientes deben ejecutarse desde la carpeta raíz del proyecto, donde se encuentra `docker-compose.yml`.

## Inicio mediante Docker Compose

```bash
docker compose up --build -d
```

Comprobar los servicios:

```bash
docker compose ps
```

La configuración inicia dos servicios: `backend` (FastAPI/Uvicorn, puerto `8000`) y `frontend` (servidor de desarrollo Vite, puerto `5173`). En esta ejecución local, React funciona en el navegador y se comunica con la API mediante HTTP. El frontend utiliza `http://localhost:8000` como URL predeterminada del backend; no se requiere crear un archivo `.env` para esta modalidad local.

Direcciones de acceso:

| Recurso | Dirección |
| --- | --- |
| Aplicación web | http://localhost:5173 |
| Verificación del backend | http://localhost:8000/health |
| Catálogo de algoritmos | http://localhost:8000/algorithms |
| Documentación interactiva de la API | http://localhost:8000/docs |

La respuesta esperada de `/health` es:

```json
{"status":"ok"}
```

Si la página carga antes de que el backend esté disponible y no aparece el catálogo de algoritmos, comprobar `/health` y volver a cargar la interfaz.

## Archivos de prueba

Los siguientes archivos se incorporaron a la carpeta `datos_prueba/` y se utilizaron durante el desarrollo y la evaluación de usabilidad mediante SUS:

| Archivo | Función |
| --- | --- |
| `datos_prueba/LISTADO_CHILE.csv` | Estaciones GNSS existentes utilizadas como base espacial para las pruebas. |
| `datos_prueba/raster_arclim_mean_temperature_delta.geojson` | Capa geoespacial contextual para comprobar su carga y representación cartográfica. |

**CSV:** el backend requiere extensión `.csv`, texto decodificable como UTF-8 y las columnas `ID`, `STATION`, `LATITUDE` y `LONGITUDE` (con esos nombres exactos). Las coordenadas deben ser numéricas y debe existir al menos una estación válida. Es recomendable guardar el archivo en UTF-8 sin BOM.

**GeoJSON:** el backend requiere extensión `.geojson`, JSON válido y un objeto de tipo `FeatureCollection` con al menos un elemento en `features`. Para la visualización de la capa temática se utilizan los valores de `properties.valor_centroide` cuando están presentes; esta propiedad no es una condición obligatoria de la validación básica del archivo en la API.

Aunque el nombre del GeoJSON incluye «raster», el archivo que carga la aplicación es un **GeoJSON vectorial**, no un ráster leído directamente por el prototipo. Sus atributos no corresponden a mediciones de variabilidad del desplazamiento GNSS utilizadas para generar las soluciones.

La autorización para publicar estos archivos se considera separada de la licencia del código fuente. No se presupone que los datos de terceros estén cubiertos por la licencia del software.

## Comprobación funcional

1. Abrir http://localhost:5173.
2. En **Datos de entrada**, seleccionar el GeoJSON y el CSV de la carpeta `datos_prueba/`.
3. En **Algoritmo de prueba**, seleccionar NSGA-II como alternativa simulada y dejar los parámetros predeterminados.
4. Definir **5 estaciones nuevas** por solución y **5 soluciones** para el escenario. La semilla es opcional; si se ingresa, debe ser un número entero.
5. Presionar **Generar escenario** y verificar el resumen de resultados.
6. Comprobar el gráfico de Pareto y los controles para mostrar todos los frentes o solo el frente 0.
7. Seleccionar un punto del gráfico y comprobar que se actualicen el detalle de la solución y las estaciones nuevas en el mapa.
8. Verificar los controles de visibilidad de las capas cartográficas.

Con los mismos archivos de entrada, las mismas cantidades de estaciones y soluciones, la misma semilla y la misma versión del código, la generación pseudoaleatoria produce los mismos valores objetivo y coordenadas propuestas. En consecuencia, también se obtiene la misma clasificación de Pareto. Esto no constituye una validación geodésica.

## Pruebas automatizadas del backend

Con el servicio `backend` iniciado, ejecutar desde la raíz del repositorio:

```bash
docker compose exec backend python -m pytest -q tests
```

En la comprobación local realizada durante la preparación de la documentación, **las 44 pruebas automatizadas del backend finalizaron satisfactoriamente**. Estas pruebas cubren funciones internas y rutas de la API; no equivalen a pruebas automatizadas de la interfaz ni demuestran la calidad geodésica de las ubicaciones simuladas.

## Detener los servicios

```bash
docker compose down
```

El comando detiene y retira los contenedores y la red de Compose, sin borrar los archivos fuente ni los datos de prueba almacenados en el directorio del proyecto.


## Licencia y datos

El código fuente propio de este proyecto se distribuye bajo la **PolyForm Noncommercial License 1.0.0**, cuyo texto completo puede consultarse en el archivo [LICENSE.md](LICENSE.md).

Esta licencia permite los usos no comerciales establecidos en sus condiciones, incluyendo determinados usos académicos y de investigación. Los usos comerciales que no estén autorizados por la licencia requieren una autorización independiente de los titulares de derechos.

La elección de esta licencia busca facilitar la revisión, reproducción y reutilización académica del prototipo, conservando la posibilidad de autorizar por separado su explotación comercial.

Los archivos incluidos en `datos_prueba/` se proporcionan como insumos para reproducir las comprobaciones funcionales. Su publicación no implica que estén cubiertos por PolyForm Noncommercial, por lo que su reutilización debe respetar los derechos y condiciones de sus fuentes originales.

Las dependencias de terceros conservan sus respectivas licencias.

