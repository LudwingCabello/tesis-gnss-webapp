from fastapi.testclient import TestClient
from main import app


client = TestClient(app)

# Se importa json para poder convertir el diccionario de GeoJSON a una cadena JSON antes de enviarlo en la solicitud.

import json


VALID_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "valor_centroide": 1.5
            },
            "geometry": {
                "type": "Point",
                "coordinates": [-70.66, -33.45]
            }
        }
    ]
}


VALID_CSV = (
    "ID,STATION,LATITUDE,LONGITUDE\n"
    "1,SANT,-33.45,-70.66\n"
    "2,VALP,-33.04,-71.61\n"
)


def build_scenario_request(seed="42"):
    files = {
        "raster_file": (
            "raster.geojson",
            json.dumps(VALID_GEOJSON).encode("utf-8"),
            "application/geo+json"
        ),
        "stations_file": (
            "stations.csv",
            VALID_CSV.encode("utf-8"),
            "text/csv"
        )
    }

    data = {
        "algorithm": "nsga2",
        "algorithm_params": json.dumps({
            "population_size": 50,
            "generations": 100,
            "mutation_rate": 0.1
        }),
        "n_stations": "2",
        "n_solutions": "5",
        "seed": seed
    }

    return files, data



# Verifica que el backend esté disponible.
def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert isinstance(response.json(), dict)


# Verifica que el catálogo de algoritmos pueda obtenerse correctamente.
def test_algorithms_endpoint():
    response = client.get("/algorithms")

    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, dict)
    assert "algorithms" in data

    algorithms = data["algorithms"]

    assert isinstance(algorithms, list)
    assert len(algorithms) >= 2
    assert any(algorithm["id"] == "nsga2" for algorithm in algorithms)
    assert any(algorithm["id"] == "mosa" for algorithm in algorithms)

# Verifica el flujo completo de creación de un escenario válido.
def test_scenario_endpoint_returns_complete_scenario():
    files, form_data = build_scenario_request(seed="42")

    response = client.post(
        "/scenario",
        files=files,
        data=form_data
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "success"
    assert "scenario" in data
    assert "raster" in data
    assert "stations" in data
    assert "solutions" in data

    assert data["scenario"]["n_stations"] == 2
    assert data["scenario"]["n_solutions"] == 5
    assert data["scenario"]["seed"] == 42

    assert data["raster"]["geojson_type"] == "FeatureCollection"
    assert data["raster"]["features_count"] == 1

    assert data["stations"]["total"] == 2
    assert len(data["stations"]["items"]) == 2

    assert len(data["solutions"]) == 5

    for solution in data["solutions"]:
        assert "id" in solution
        assert "objective_1" in solution
        assert "objective_2" in solution
        assert "pareto_front" in solution
        assert "new_stations" in solution
        assert len(solution["new_stations"]) == 2

# Verifica que dos ejecuciones con las mismas entradas y semilla
# produzcan exactamente las mismas soluciones.
def test_scenario_same_seed_returns_same_solutions():
    files_1, form_data_1 = build_scenario_request(seed="42")
    response_1 = client.post(
        "/scenario",
        files=files_1,
        data=form_data_1
    )

    files_2, form_data_2 = build_scenario_request(seed="42")
    response_2 = client.post(
        "/scenario",
        files=files_2,
        data=form_data_2
    )

    assert response_1.status_code == 200
    assert response_2.status_code == 200

    solutions_1 = response_1.json()["solutions"]
    solutions_2 = response_2.json()["solutions"]

    assert solutions_1 == solutions_2

# Verifica que el endpoint rechace un CSV sin las columnas obligatorias.
def test_scenario_rejects_csv_with_missing_columns():
    invalid_csv = (
        "ID,STATION,LATITUDE\n"
        "1,SANT,-33.45\n"
    )

    files = {
        "raster_file": (
            "raster.geojson",
            json.dumps(VALID_GEOJSON).encode("utf-8"),
            "application/geo+json"
        ),
        "stations_file": (
            "stations.csv",
            invalid_csv.encode("utf-8"),
            "text/csv"
        )
    }

    form_data = {
        "algorithm": "nsga2",
        "algorithm_params": "{}",
        "n_stations": "2",
        "n_solutions": "5",
        "seed": "42"
    }

    response = client.post(
        "/scenario",
        files=files,
        data=form_data
    )

    assert response.status_code == 400
    assert "columnas" in response.json()["detail"]

# Verifica que el endpoint rechace escenarios con cero estaciones nuevas.
def test_scenario_rejects_zero_new_stations():
    files, form_data = build_scenario_request(seed="42")
    form_data["n_stations"] = "0"

    response = client.post(
        "/scenario",
        files=files,
        data=form_data
    )

    assert response.status_code == 400
    assert "estaciones" in response.json()["detail"]