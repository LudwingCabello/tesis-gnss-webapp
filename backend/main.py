from fastapi import FastAPI, UploadFile, File, Form 
from fastapi import HTTPException 
from fastapi.middleware.cors import CORSMiddleware
import json
import random
import csv 
import io

app = FastAPI()

# permite que el frontend (que corre en otro puerto) pueda hacer peticiones al backend sin problemas de CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/") 
def read_root():
    return {"message": "Backend funcionando correctamente"}

@app.get("/health") 
def health_check():
    return {"status": "ok"}

# Endpoint para obtener soluciones de ejemplo
@app.get("/solutions")
def read_solutions():
    return {
        "solutions": [
            {
                "id":1,
                "objective_1": 0.8,
                "objective_2": 0.4,
                "stations": [
                    {"lat": 40.7128, "lon": -74.0060},
                    {"lat": 34.0522, "lon": -118.2437}
                ]
            },
            {
                "id":2,
                "objective_1": 0.6,
                "objective_2": 0.7,
                "stations": [
                    {"lat": 51.5074, "lon": -0.1278},
                    {"lat": 48.8566, "lon": 2.3522}
                ]
            }
        ]
    }

@app.post("/upload-raster")
#recibe el archivo raster como UploadFile, lo lee y lo convierte en JSON
async def upload_raster(file: UploadFile = File(...)): 
    try: 
        content = await file.read()
        data = json.loads(content)
        geojson_type = data.get("type", "Desconocido")
        features = data.get("features", [])
        crs = data.get("crs", None)
                        
        return {
            "message": "Raster recibido correctamente",
            "filename": file.filename,
            "content_type": file.content_type,
            "geojson_type": geojson_type,
            "features_count": len(features),
            "has_cres": crs is not None,
            "keys": list(data.keys())
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/upload-stations")
async def upload_stations(file: UploadFile = File(...)):
    try:
        content = await file.read()
        # Convierte bytes a texto y luego a una lista de diccionarios usando csv.DictReader
        decoded = content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        # Convierto el reader en una lista para analizar su contenido
        stations = list(reader)

        if not stations: 
            raise HTTPException(
                status_code=400,
                detail="El archivo de estaciones está vacío"
            )
        # Datos cruciales para el funcionamiento del sistema
        required_columns = {"STATION", "LATITUDE", "LONGITUDE", "ID"}
        # Extraigo los titulos de las columnas del archivo
        file_columns = set(stations[0].keys())
        if not required_columns.issubset(file_columns):
            raise HTTPException(
                status_code=400,
                detail=f"El archivo debe contener las columnas: {required_columns}"
            )
        #Devuelvo información del archivo 
        return {
            "message": "Archivo de estaciones recibido correctamente",
            "filename": file.filename,
            "content_type": file.content_type,
            "stations_count": len(stations),
            "columns": list(file_columns),
            "sample_station": stations[0]
        }
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="No se pudo leer el archivo como texto UTF-8"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando archivo de estaciones: {str(e)}"
        )

# Endpoint para obtener el catálogo de algoritmos disponibles, con sus parámetros y descripciones
ALGORITHM_CATALOG = [
    {
        "id": "nsga2",
        "name": "NSGA-II",
        "description": "Algoritmo evolutivo multiobjetivo de prueba.",
        "parameters": [
            {
                "name": "population_size",
                "label": "Tamaño de población",
                "type": "number",
                "default": 50,
                "min": 1
            },
            {
                "name": "generations",
                "label": "Número de generaciones",
                "type": "number",
                "default": 100,
                "min": 1
            },
            {
                "name": "mutation_rate",
                "label": "Tasa de mutación",
                "type": "number",
                "default": 0.1,
                "min": 0,
                "max": 1
            }
        ]
    },
    {
        "id": "mosa",
        "name": "MOSA",
        "description": "Recocido simulado multiobjetivo de prueba.",
        "parameters": [
            {
                "name": "initial_temperature",
                "label": "Temperatura inicial",
                "type": "number",
                "default": 100,
                "min": 1
            },
            {
                "name": "cooling_rate",
                "label": "Tasa de enfriamiento",
                "type": "number",
                "default": 0.95,
                "min": 0,
                "max": 1
            },
            {
                "name": "iterations",
                "label": "Iteraciones",
                "type": "number",
                "default": 100,
                "min": 1
            }
        ]
    }
]

@app.get("/algorithms")
async def get_algorithms():
    return {
        "algorithms": ALGORITHM_CATALOG
    }

# Función para asegurar una subida de archivos correcta y con el formato esperado para el funcionamiento del sistema   
def validate_uploaded_files(raster_file: UploadFile, stations_file: UploadFile):
    
    if not raster_file.filename:
        raise HTTPException(
            status_code=400,
            detail="Debe subir un archivo raster"
        )
    
    if not stations_file.filename:
        raise HTTPException(
            status_code=400,
            detail="Debe subir un archivo de estaciones"
        )
    
    if not raster_file.filename.endswith(".geojson"):
        raise HTTPException(
            status_code=400,
            detail="El archivo raster debe tener extensión .geojson"
        )
    
    if not stations_file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="El archivo de estaciones debe tener extensión .csv"
        )

# Función para generar estaciones nuevas dummy cercanas a las estaciones existentes
def generate_dummy_new_stations(n_stations: int, base_station: list):
    new_stations = []

    # Se toma la latitud y longitud de la estación base para generar coordenadas cercanas
    base_lat = base_station["latitude"]
    base_lon = base_station["longitude"]

    for i in range(n_stations):
        new_station = {
            "id": f"NEW_{i+1}",
            # Mueve la nueva estación alrededor de la existente
            "latitude": round(base_lat + random.uniform(-0.08, 0.08), 6),
            "longitude": round(base_lon + random.uniform(-0.08, 0.08), 6)        
        }
        new_stations.append(new_station)

    return new_stations


# Funcion para determinar si una solución domina a otra 
# ( mientras mayor  sea el valor de los objetivos, mejor es la solución)
def dominates(sol_a, sol_b):
    return (
        # Para que una solución A domine a otra B, A debe ser igual o mejor en ambos objetivos y estrictamente mejor en al menos uno
        sol_a["objective_1"] >= sol_b["objective_1"] and
        sol_a["objective_2"] >= sol_b["objective_2"] and
        (
            # Al menos uno de los objetivos debe ser estrictamente mejor para que una solución domine a la otra
            sol_a["objective_1"] > sol_b["objective_1"] or
            sol_a["objective_2"] > sol_b["objective_2"]
        )
    )

# Función para asignar frentes de pareto a una lista de soluciones
def pareto_fronts(solutions):
    # Se crea copia de la lista de soluciones
    list = solutions[:]
    # Se empieza por el frente 0
    front_number = 0

    # Mientras queden soluciones por evaluar, se sigue buscando el siguiente frente de pareto
    while list:
        # Lista vacia para el frente actual
        actual_front = []
        # Se revisa cada solucion pendiente
        for sol in list:
            # Se asume que solución no esta dominada
            dominated = False
            # Se compara con todas las soluciones de la copia de la lista de soluciones
            for other in list:
                # Si se encuentra otra que la domina, se marca como dominada
                if sol != other and dominates(other, sol):
                    dominated = True
                    break
            # Si no se encuentra ninguna solución que la domine, se agrega al frente actual
            if not dominated:
                actual_front.append(sol)
        # Se asigna el número de frente de pareto a cada solución del frente actual
        for sol in actual_front:
            sol["pareto_front"] = front_number
        # Se eliminan las soluciones del frente actual de la lista de soluciones pendientes
        list = [sol for sol in list if sol not in actual_front]
        # Se pasa al siguiente frente de pareto
        front_number += 1   
    
    return solutions

# Función para validar que la estructura de las soluciones generadas sea correcta 
# y contenga los campos necesarios para el funcionamiento del sistema          
def validate_solution_json(solutions: list):

    # Valida que la salida de soluciones sea una lista 
    if not isinstance(solutions, list):
        raise HTTPException(
            status_code=500,
            detail="La salida de soluciones debe ser una lista"
        )
    
    # Valida que la lista de soluciones no esté vacía
    if len(solutions) == 0:
        raise HTTPException(
            status_code=500,
            detail="La lista de soluciones no puede estar vacía"
        )
    
    # Valida los campos requeridos para cada solución 
    required_solution_fields= {
        "id",
        "objective_1",
        "objective_2",
        "pareto_front",
        "new_stations"
    }

    # Campos requeridos para cada estación nueva dentro de las soluciones
    required_station_fields = {
        "id",
        "latitude",
        "longitude"
    }

    # Se valida cada solución de la lista para asegurar que contenga los campos necesarios y que las estaciones nuevas tengan la estructura correcta
    for solution in solutions:
        # Se verifica que cada solución contenga los campos requeridos para su correcto funcionamiento
        missing_fields = required_solution_fields - solution.keys()

        # Si faltan campos requeridos en la solución, se lanza una excepción con un mensaje detallado indicando qué campos faltan y a qué solución corresponde
        if missing_fields:
            raise HTTPException(
                status_code=500,
                detail=f"La solución {solution.get('id', 'sin_id')} no contiene los campos requeridos: {missing_fields}"
            )
        
        # Se verifica que el campo de estaciones nuevas sea una lista, ya que se espera que contenga múltiples estaciones con su propia estructura
        if not isinstance(solution["new_stations"], list):
            raise HTTPException(
                status_code=500,
                detail=f"La solución {solution['id']} debe contener una lista de estaciones nuevas"
            )
        
        # Se valida cada estación nueva dentro de la solución para asegurar que contenga los campos necesarios 
        for station in solution["new_stations"]:
            # Se verifica que cada estación nueva contenga los campos requeridos para su correcto funcionamiento
            missing_station_fields = required_station_fields - set(station.keys())

            # Si faltan campos requeridos en alguna estación nueva, se lanza una excepción con un mensaje indicando qué campos faltan, a qué estación corresponde y a qué solución pertenece esa estación
            if missing_station_fields:
                raise HTTPException(
                    status_code=500,
                    detail=f"La estación {station.get('id', 'sin_id')} en la solución {solution['id']} no contiene los campos requeridos: {missing_station_fields}"      
                )
            
            # Se verifica que las coordenadas latitud y longitud sean numericas
            if not isinstance(station["latitude"], (int, float)):
                raise HTTPException(
                    status_code=500,
                    detail=f"La latitud de la estación {station['id']} debe ser numerica"
                )
            
            if not isinstance(station["longitude"], (int, float)):
                raise HTTPException(
                    status_code=500,
                    detail=f"La longitud de la estación {station['id']} debe ser numerica"
                )


    
@app.post("/scenario") 
async def create_escenario(
    # Recibe ambos archivos y el numero de estaciones a generar
    raster_file: UploadFile = File(...),
    stations_file: UploadFile = File(...),
    n_stations: int = Form(...),
    n_solutions: int = Form(5)
):   
    try: 
        
        # Se valida que los archivos subidos sean correctos y tengan el formato esperado
        validate_uploaded_files(raster_file, stations_file)

        # Validar que el numero de nuevas estaciones sea mayor que 0
        if n_stations <= 0:
            raise HTTPException(
                status_code=400,
                detail= "El número de estaciones debe ser mayor que cero"
            )
        # Validar que el número de soluciones sea mayor que 0
        if n_solutions <= 0:
            raise HTTPException(
                status_code=400,
                detail= "El número de soluciones debe ser mayor que cero"
            )
        
        # ---------- Procesar raster ----------
        # Lee el contenido del archivo raster, lo decodifica y lo convierte a JSON
        raster_content = await raster_file.read()
        raster_data = json.loads(raster_content)
        
        raster_features = raster_data.get("features", [])
        raster_type = raster_data.get("type", "Desconocido")
        raster_has_crs = raster_data.get("crs") is not None

        # ---------- Procesar estaciones ----------
        # Lee el contenido del archivo de estaciones, lo decodifica y lo convierte a una lista de diccionarios
        stations_content = await stations_file.read()
        stations_decoded = stations_content.decode("utf-8")
        stations_reader = csv.DictReader(io.StringIO(stations_decoded))
        stations = list(stations_reader)

        # Valida que existan estaciones en el archivo
        if not stations:
            raise HTTPException(
                status_code=400,
                detail="El archivo de estaciones está vacío"
            )
        
        # Valida que archivo contenga datos de utilidad para el sistema
        required_columns = {"STATION", "LATITUDE", "LONGITUDE", "ID"}
        file_columns = set(stations[0].keys())
        # Valida que el archivo contenga las columnas necesarias para el funcionamiento del sistema
        if not required_columns.issubset(file_columns):
            raise HTTPException(
                status_code=400,
                detail=f"El archivo de estaciones debe contener las columnas: {required_columns}"
            )
        
        # Se crea lista para almacenar estaciones existentes con formato adecuado para el mapa
        stations_for_map = []
        for station in stations:
            try:
                # Se van agregando las estaciones a la lista
                stations_for_map.append({
                    "id": station["ID"],
                    "station": station["STATION"],
                    # Se convierten las coordenadas a float para que puedan ser usadas en el mapa
                    "latitude": float(station["LATITUDE"]),
                    "longitude": float(station["LONGITUDE"])
                })
            except (ValueError, KeyError):
                continue

        # Se construye una lista de soluciones dummy 
        solutions = []
        # Se elige una estación base aleatoria de la lista de estaciones para generar las nuevas estaciones cercanas a ella
        base_sstation = random.choice(stations_for_map)
        # Se genera la cantidad de soluciones indicada por el usuario
        for i in range(n_solutions):
            solution = {
                "id": i + 1,
                # Se generan valores aleatorios entre 0.2 y 1.0 para los objetivos, redondeados a 3 decimales
                "objective_1": round(random.uniform(0.2, 1.0), 3),
                "objective_2": round(random.uniform(0.2, 1.0), 3),
                # Frontera de pareto asignada aleatoriamente entre 0 y 2 
                "new_stations": generate_dummy_new_stations(n_stations, base_sstation)
            }
            solutions.append(solution)
        
        # Se asignan los frentes de pareto a las soluciones generadas
        solutions = pareto_fronts(solutions)

        # Se valida que la estructura de las soluciones generadas sea correcta 
        # y contenga los campos necesarios para el funcionamiento del sistema
        validate_solution_json(solutions)
        
        #---------- Respuesta estructurada----------
        return {
            "status": "success",
            "message": "Escenario creado correctamente",
            "scenario": {
                "raster_filename": raster_file.filename,
                "stations_filename": stations_file.filename,
                "n_stations": n_stations,
                "n_solutions": n_solutions 
            },
            "raster": {
                "geojson_type": raster_type,
                "features_count": len(raster_features),
                "has_crs": raster_has_crs
            },
            "stations": {
                "total": len(stations),
                "columns": list(file_columns),
                "sample_station": stations[0],
                "items" : stations_for_map
            },
            "solutions": solutions
        }
    
    # Manejo de errores especificos para cada tipo de problema
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="El archivo raster no es un JSON/GeoJSON válido"
        )
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="No se pudo leer el archivo de estaciones como texto UTF-8"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando el escenario: {str(e)}"
        )
