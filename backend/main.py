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

# Función para generar estaciones nuevas dummy
def generate_dummy_new_stations(n_stations: int):
    new_stations = []

    for i in range(n_stations):
        station = {
            "id": f"NEW_{i+1}",
            #generamos numeros aleatorios entre rangos correspondientes al territorio chileno
            "latitude": round(random.uniform(-56.0, -17.0), 6),
            "longitude": round(random.uniform(-76.0, -66.0), 6)        
        }
        new_stations.append(station)
    return new_stations
    
@app.post("/scenario") 
async def create_escenario(
    # Recibe ambos archivos y el numero de estaciones a generar
    raster_file: UploadFile = File(...),
    stations_file: UploadFile = File(...),
    n_stations: int = Form(...),
    n_solutions: int = Form(5)
):   
    try: 

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

        #Se consytruye una lista de soluciones dummy 
        solutions = []
        # Se genera la cantidad de soluciones indicada por el usuario
        for i in range(n_solutions):
            solution = {
                "id": i + 1,
                # Se generan valores aleatorios entre 0.2 y 1.0 para los objetivos, redondeados a 3 decimales
                "objective_1": round(random.uniform(0.2, 1.0), 3),
                "objective_2": round(random.uniform(0.2, 1.0), 3),
                # Frontera de pareto asignada aleatoriamente entre 0 y 2 
                "pareto_front": random.randint(0, 2),
                "new_stations": generate_dummy_new_stations(n_stations)
            }
            solutions.append(solution)
        
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
