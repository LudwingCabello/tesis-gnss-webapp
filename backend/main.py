from fastapi import FastAPI, UploadFile, File, Form 
from fastapi import HTTPException 
from fastapi.middleware.cors import CORSMiddleware
import json
import csv 
import io

app = FastAPI()

# permite que el frontend (que corre en otro puerto) pueda hacer peticiones al backend sin problemas de CORS (Cross-Origin Resource Sharing)
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
    
@app.post("/scenario") 
async def create_escenario(
    raster_file: UploadFile = File(...),
    stations_file: UploadFile = File(...),
    n_stations: int = Form(...)
):   
    try: 
        if n_stations <= 0:
            raise HTTPException(
                status_code=400,
                detail= "El número de estaciones debe ser mayor que cero"
            )
        
        # ---------- Procesar raster ----------
        raster_content = await raster_file.read()
        raster_data = json.loads(raster_content)

        raster_features = raster_data.get("features", [])
        raster_type = raster_data.get("type", "Desconocido")
        raster_has_crs = raster_data.get("crs") is not None

        # ---------- Procesar estaciones ----------
        stations_content = await stations_file.read()
        stations_decoded = stations_content.decode("utf-8")
        stations_reader = csv.DictReader(io.StringIO(stations_decoded))
        stations = list(stations_reader)

        if not stations:
            raise HTTPException(
                status_code=400,
                detail="El archivo de estaciones está vacío"
            )
        
        required_columns = {"STATION", "LATITUDE", "LONGITUDE", "ID"}
        file_columns = set(stations[0].keys())

        if not required_columns.issubset(file_columns):
            raise HTTPException(
                status_code=400,
                detail=f"El archivo de estaciones debe contener las columnas: {required_columns}"
            )
        
        #---------- Respuesta estructurada----------
        return {
            "message": "Escenario creado correctamente",
            "input": {
                "raster_filename": raster_file.filename,
                "n_stations_requested": n_stations,
                "stations_filename": stations_file.filename
            },
            "raster_info": {
                "geojson_type": raster_type,
                "features_count": len(raster_features),
                "has_crs": raster_has_crs
            },
            "stations_info": {
                "total_stations": len(stations),
                "columns": list(file_columns),
                "sample_station": stations[0]
            },
            "generated_solutions": [
                {
                    "id": 1,
                    "objective_1": 0.75,
                    "objective_2": 0.65,
                    "stations_generated": n_stations
                }
            ]
        }
    
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
