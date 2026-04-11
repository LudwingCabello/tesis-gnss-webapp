from fastapi import FastAPI, UploadFile, File, Form 
from fastapi import HTTPException 
import json
from fastapi.middleware.cors import CORSMiddleware

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

# Endpoint para crear escenario, recibe el raster y el número de estaciones solicitadas, procesa el raster 
# y devuelve una respuesta con las soluciones (simuladas en este caso)
@app.post("/scenario") 
async def create_scenario(
    file: UploadFile = File(...),
    n_stations: int = Form(...),
):
    try:
        content = await file.read()
        data = json.loads(content)

        features = data.get("features", [])
        if n_stations <= 0:
            raise HTTPException(
                status_code=400, 
                detail="El número de estaciones debe ser mayor que cero"
            )

        return {
            "message": "Escenario creado correctamente",
            "input":{
                "filename": file.filename,
                "n_stations_requested": n_stations
            },
            "raster_info":{
                "geojson_type": data.get("type", "Desconocido"),
                "features_count": len(features),
                "has_crs": data.get("crs", None) is not None,
                "keys": list(data.keys())
            },
            "generated_solutions": [
                { 
                    "id": 1,
                    "objective_1": 0.5,
                    "objective_2": 0.3,
                    "stations": n_stations
                }
            ]
        }
    except Exception as e:
        return {"error": str(e)}