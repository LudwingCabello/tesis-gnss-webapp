from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

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