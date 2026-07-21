import pytest
from fastapi import HTTPException

from main import (
    validate_positive_integer, 
    process_stations_csv, 
    process_raster_geojson, 
    generate_dummy_new_stations,
    generate_dummy_solutions,
    dominates,
    pareto_fronts,
    validate_solution_json,
    validate_algorithm_params
)

# Prueba básica para verificar que pytest funciona correctamente
def test_pytest_funciona():
    assert 1 + 1 == 2

#------------------ VALIDACIÓN DE ENTEROS POSITIVOS ------------------
# Prueba que valida que la funición acepte valores positivios
def test_validate_positive_integer_accepts_positive_value():
    validate_positive_integer(
        5,
        "El número de estaciones debe ser mayor que cero"
    )

# Prueba que valida que la función rechace el valor cero
def test_validate_positive_integer_rejects_zero():
    with pytest.raises(HTTPException) as exc_info:
        validate_positive_integer(
            0,
            "El número de estaciones debe ser mayor que cero"
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El número de estaciones debe ser mayor que cero"

# Prueba que valida que la función rechace valores negativos
def test_validate_positive_integer_rejects_negative_value():
    with pytest.raises(HTTPException) as exc_info:
        validate_positive_integer(
            -3,
            "El número de estaciones debe ser mayor que cero"
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El número de estaciones debe ser mayor que cero"

#------------------ VALIDACIÓN DE ARCHIVOS CSV ------------------

# Prueba que valida el procesamiento de un archivo CSV válido
def test_process_stations_csv_valid_file():
    # Simulamos el contenido de un archivo CSV con datos de estaciones
    csv_content = (
        "ID,STATION,LATITUDE,LONGITUDE\n"
        "1,SANT,-33.45,-70.66\n"
        "2,VALP,-33.04,-71.61\n"
    ).encode("utf-8")

    # Procesamos el CSV y verificamos que los datos se hayan interpretado correctamente
    result = process_stations_csv(csv_content)

    # Verificamos que el resultado sea una lista con los datos de las estaciones
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[0]["station"] == "SANT"
    assert result[0]["latitude"] == -33.45
    assert result[0]["longitude"] == -70.66

# Prueba que valida el procesamiento de un archivo CSV vacío
def test_process_stations_csv_empty_file():
    csv_content = "".encode("utf-8")

    # Procesamos el CSV y verificamos que se lance una excepción HTTP con el mensaje adecuado
    with pytest.raises(HTTPException) as exc_info:
        process_stations_csv(csv_content)

    # Verificamos que la excepción tenga el código de estado 400 y el mensaje correcto
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El archivo de estaciones está vacío"

# Prueba que valida el procesamiento de un archivo CSV con columnas faltantes
def test_process_stations_csv_missing_columns():
    csv_content = (
        "ID,STATION,LATITUDE\n"
        "1,SANT,-33.45\n"
    ).encode("utf-8")

    with pytest.raises(HTTPException) as exc_info:
        process_stations_csv(csv_content)

    assert exc_info.value.status_code == 400
    assert "El archivo de estaciones debe contener las columnas" in exc_info.value.detail

#------------------ VALIDACIÓN DE ARCHIVOS GEOJSON ------------------

# Prueba que valida el procesamiento de un archivo GeoJSON válido
def test_process_raster_geojson_valid_file():
    geojson_content = b'''
    {
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
    '''
    result = process_raster_geojson(geojson_content)

    assert result["geojson_type"] == "FeatureCollection"
    assert result["features_count"] == 1
    assert result["has_crs"] is False
    assert "geojson" in result

# Prueba que valida el procesamiento de un archivo GeoJSON sin features
def test_process_raster_without_features():
    geojson_content = b'''
    {
        "type": "FeatureCollection",
        "features": []
    }
    '''
    with pytest.raises(HTTPException) as exc_info:
        process_raster_geojson(geojson_content)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El archivo raster no contiene features"

# Prueba que valida el procesamiento de un archivo GeoJSON con formato inválido
def test_process_raster_geojson_invalid_type():
    geojson_content = b'''
    {
        "type": "Point",
        "coordinates": [-70.66, -33.45]
    }
    '''
    with pytest.raises(HTTPException) as exc_info:
        process_raster_geojson(geojson_content)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El archivo raster debe ser un GeoJSON de tipo FeatureCollection"


#------------------ VALIDACIÓN DE ESTACIONES DUMMY ------------------

# Prueba que valida que se genere la cantidad solicitada de estaciones nuevas
def test_generate_dummy_new_stations_count():
    base_station = {
        "id": "1",
        "station": "SANT",
        "latitude": -33.45,
        "longitude": -70.66
    }

    result = generate_dummy_new_stations(5, base_station)

    assert len(result) == 5

# Prueba que valida que cada estacón nueva tenga la estructura esperada
def test_generate_dummy_new_stations_estructure():
    base_station = {
        "id": "1",
        "station": "SANT",
        "latitude": -33.45,
        "longitude": -70.66
    }

    result = generate_dummy_new_stations(3, base_station)

    for station in result:
        assert "id" in station
        assert "latitude" in station
        assert "longitude" in station

# Prueba que valida que las coordenadas generadas sean numericas
def test_generate_dummy_new_stations_coordinates_are_numbers():
    base_station = {
        "id": "1",
        "station": "SANT",
        "latitude": -33.45,
        "longitude": -70.66
    }

    result = generate_dummy_new_stations(3, base_station)

    for station in result:
        assert isinstance(station["latitude"], (int, float))
        assert isinstance(station["longitude"], (int, float))

# Prueba que valida que las estaciones nuevas se generen cerca de la estación base
def test_generate_dummy_new_stations_near_base_station():
    base_station = {
        "id": "1",
        "station": "SANT",
        "latitude": -33.45,
        "longitude": -70.66
    }

    result = generate_dummy_new_stations(5, base_station)

    for station in result:
        assert -33.53 <= station["latitude"] <= -33.37
        assert -70.74 <= station["longitude"] <= -70.58

#------------------ VALIDACIÓN DE SOLUCIONES DUMMY ------------------

# Prueba que valida que se genere la cantidad solicitada de soluciones
def test_generate_dummy_solutions_count():
    stations_for_map = [
        {
            "id": "1",
            "station": "SANT",
            "latitude": -33.45,
            "longitude": -70.66
        }
    ]

    result = generate_dummy_solutions(5, 3, stations_for_map)

    assert len(result) == 5
    
# Prueba que valida que cada solución tenga la estructura esperada
def test_generate_dummy_solutions_structure():
    stations_for_map = [
        {
            "id": "1",
            "station": "SANT",
            "latitude": -33.45,
            "longitude": -70.66
        }
    ]

    result = generate_dummy_solutions(3, 2, stations_for_map)

    for solution in result:
        assert "id" in solution
        assert "objective_1" in solution
        assert "objective_2" in solution
        assert "pareto_front" in solution
        assert "new_stations" in solution

# Prueba que valida que cada solución tenga la cantidad solicitada de estaciones nuevas
def test_generate_dummy_solutions_new_stations_count():
    stations_for_map = [
        {
            "id": "1",
            "station": "SANT",
            "latitude": -33.45,
            "longitude": -70.66
        }
    ]

    result = generate_dummy_solutions(4, 3, stations_for_map)

    for solution in result:
        assert len(solution["new_stations"]) == 3

# Prueba que valida que los valores objetivo estén dentro del rango definido para datos dummy
def test_generate_dummy_solutions_range():
    stations_for_map = [
        {
            "id": "1",
            "station": "SANT",
            "latitude": -33.45,
            "longitude": -70.66
        }
    ]

    result = generate_dummy_solutions(5, 2, stations_for_map)

    for solution in result:
        assert 0.2 <= solution["objective_1"] <= 1.0
        assert 0.2 <= solution["objective_2"] <= 1.0


#------------------ VALIDACIÓN DE FRENTES DE PARETO ------------------

# Prueba que valida dominancia cuando ambos objetivos se maximixan
def test_dominates_when_both_objectives_are_higher():
    sol_a = { "objective_1": 0.9, "objective_2": 0.8 }
    sol_b = { "objective_1": 0.7, "objective_2": 0.5 }

    assert dominates(sol_a, sol_b) is True

# Prueba que valida que no hay dominancia cuando existe un compromiso entre obejtivos
def test_dominates_returns_when_tradeoff_exists():
    sol_a = { "objective_1": 0.9, "objective_2": 0.4 }
    sol_b = { "objective_1": 0.7, "objective_2": 0.8 }

    assert dominates(sol_a, sol_b) is False
    assert dominates(sol_b, sol_a) is False

# Prueba que valida que soluciones iguales no se dominen entre si
def test_dominates_returns_false_when_solutions_are_equal():
    sol_a = { "objective_1": 0.7, "objective_2": 0.7 }
    sol_b = { "objective_1": 0.7, "objective_2": 0.7 }

    assert dominates(sol_a, sol_b) is False
    assert dominates(sol_b, sol_a) is False

# Prueba que valida que la asignación de frentes de Pareto con maximización de ambos objetivos
def test_pareto_fronts_maximization():
    # Se crean soluciones dummy con diferentes combinaciones de objetivos para probar la asignación de frentes de Pareto
    solutions = [
        {"id": "A", "objective_1": 0.9, "objective_2": 0.9, "new_stations": []},
        {"id": "B", "objective_1": 0.8, "objective_2": 0.8, "new_stations": []},
        {"id": "C", "objective_1": 0.7, "objective_2": 0.7, "new_stations": []},
        {"id": "D", "objective_1": 0.95, "objective_2": 0.5, "new_stations": []},
        {"id": "E", "objective_1": 0.5, "objective_2": 0.95, "new_stations": []}
    ]

    # Se asignan los frentes de Pareto a las soluciones utilizando la función pareto_fronts
    result = pareto_fronts(solutions)

    # Se crea un diccionario para mapear las soluciones por su ID y verificar los frentes asignados
    fronts_by_id = {
        solution["id"]: solution["pareto_front"]
        for solution in result
    }

    # Se verifica que las soluciones A, D y E estén en el frente 0 (no dominadas por ninguna otra solución)
    assert fronts_by_id["A"] == 0
    assert fronts_by_id["D"] == 0
    assert fronts_by_id["E"] == 0
    assert fronts_by_id["B"] == 1
    assert fronts_by_id["C"] == 2     

#------------------ VALIDACIÓN DE ESTRUCTURA JSON ------------------

# Prueba que valida que una lista de soluciones con estructura correcta sea aceptada.
def test_validate_solution_json_valid_structure():
    solutions = [
        {
            "id": 1,
            "objective_1": 0.8,
            "objective_2": 0.6,
            "pareto_front": 0,
            "new_stations": [
                {
                    "id": "NEW_1",
                    "latitude": -33.45,
                    "longitude": -70.66
                }
            ]
        }
    ]

    validate_solution_json(solutions)


# Prueba que valida que la salida de soluciones debe ser una lista.
def test_validate_solution_json_rejects_non_list():
    solutions = {
        "id": 1,
        "objective_1": 0.8
    }

    with pytest.raises(HTTPException) as exc_info:
        validate_solution_json(solutions)

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "La salida de soluciones debe ser una lista"


# Prueba que valida que la lista de soluciones no puede estar vacía.
def test_validate_solution_json_rejects_empty_list():
    solutions = []

    with pytest.raises(HTTPException) as exc_info:
        validate_solution_json(solutions)

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "La lista de soluciones no puede estar vacía"


# Prueba que valida que cada solución debe contener todos los campos requeridos.
def test_validate_solution_json_rejects_solution_missing_required_field():
    solutions = [
        {
            "id": 1,
            "objective_1": 0.8,
            "objective_2": 0.6,
            "new_stations": []
        }
    ]

    with pytest.raises(HTTPException) as exc_info:
        validate_solution_json(solutions)

    assert exc_info.value.status_code == 500
    assert "no contiene los campos requeridos" in exc_info.value.detail


# Prueba que valida que new_stations debe ser una lista.
def test_validate_solution_json_rejects_new_stations_not_list():
    solutions = [
        {
            "id": 1,
            "objective_1": 0.8,
            "objective_2": 0.6,
            "pareto_front": 0,
            "new_stations": "no soy una lista"
        }
    ]

    with pytest.raises(HTTPException) as exc_info:
        validate_solution_json(solutions)

    assert exc_info.value.status_code == 500
    assert "debe contener una lista de estaciones nuevas" in exc_info.value.detail


# Prueba que valida que cada estación nueva debe contener id, latitude y longitude.
def test_validate_solution_json_rejects_station_missing_required_field():
    solutions = [
        {
            "id": 1,
            "objective_1": 0.8,
            "objective_2": 0.6,
            "pareto_front": 0,
            "new_stations": [
                {
                    "id": "NEW_1",
                    "latitude": -33.45
                }
            ]
        }
    ]

    with pytest.raises(HTTPException) as exc_info:
        validate_solution_json(solutions)

    assert exc_info.value.status_code == 500
    assert "no contiene los campos requeridos" in exc_info.value.detail


# Prueba que valida que latitude debe ser numérica.
def test_validate_solution_json_rejects_non_numeric_latitude():
    solutions = [
        {
            "id": 1,
            "objective_1": 0.8,
            "objective_2": 0.6,
            "pareto_front": 0,
            "new_stations": [
                {
                    "id": "NEW_1",
                    "latitude": "no numerico",
                    "longitude": -70.66
                }
            ]
        }
    ]

    with pytest.raises(HTTPException) as exc_info:
        validate_solution_json(solutions)

    assert exc_info.value.status_code == 500
    assert "debe ser numerica" in exc_info.value.detail


# Prueba que valida que longitude debe ser numérica.
def test_validate_solution_json_rejects_non_numeric_longitude():
    solutions = [
        {
            "id": 1,
            "objective_1": 0.8,
            "objective_2": 0.6,
            "pareto_front": 0,
            "new_stations": [
                {
                    "id": "NEW_1",
                    "latitude": -33.45,
                    "longitude": "no numerico"
                }
            ]
        }
    ]

    with pytest.raises(HTTPException) as exc_info:
        validate_solution_json(solutions)

    assert exc_info.value.status_code == 500
    assert "debe ser numerica" in exc_info.value.detail

#------------------ VALIDACIÓN DE PARÁMETROS DEL ALGORITMO ------------------

# Prueba que valida parámetros correctos para un algoritmo existente.
def test_validate_algorithm_params_valid_nsga2():
    algorithm_id = "nsga2"
    algorithm_params_raw = '''
    {
        "population_size": 50,
        "generations": 100,
        "mutation_rate": 0.5
    }
    '''

    selected_algorithm, params = validate_algorithm_params(
        algorithm_id,
        algorithm_params_raw
    )

    assert selected_algorithm["id"] == "nsga2"
    assert params["population_size"] == 50.0
    assert params["generations"] == 100.0
    assert params["mutation_rate"] == 0.5


# Prueba que valida que se rechace un algoritmo inexistente.
def test_validate_algorithm_params_rejects_unknown_algorithm():
    algorithm_id = "algoritmo_inexistente"
    algorithm_params_raw = "{}"

    with pytest.raises(HTTPException) as exc_info:
        validate_algorithm_params(algorithm_id, algorithm_params_raw)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El algoritmo seleccionado no existe"


# Prueba que valida que los parámetros deben venir en formato JSON válido.
def test_validate_algorithm_params_rejects_invalid_json():
    algorithm_id = "nsga2"
    algorithm_params_raw = "{ esto no es json }"

    with pytest.raises(HTTPException) as exc_info:
        validate_algorithm_params(algorithm_id, algorithm_params_raw)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Los parámetros del algoritmo no tienen formato JSON válido"


# Prueba que valida que los parámetros deben ser numéricos.
def test_validate_algorithm_params_rejects_non_numeric_value():
    algorithm_id = "nsga2"
    algorithm_params_raw = '''
    {
        "population_size": "no numerico",
        "generations": 100,
        "mutation_rate": 0.5
    }
    '''

    with pytest.raises(HTTPException) as exc_info:
        validate_algorithm_params(algorithm_id, algorithm_params_raw)

    assert exc_info.value.status_code == 400
    assert "debe ser numérico" in exc_info.value.detail


# Prueba que valida que un parámetro no sea menor al mínimo definido.
def test_validate_algorithm_params_rejects_value_below_minimum():
    algorithm_id = "nsga2"
    algorithm_params_raw = '''
    {
        "population_size": 0,
        "generations": 100,
        "mutation_rate": 0.5
    }
    '''

    with pytest.raises(HTTPException) as exc_info:
        validate_algorithm_params(algorithm_id, algorithm_params_raw)

    assert exc_info.value.status_code == 400
    assert "debe ser mayor o igual" in exc_info.value.detail


# Prueba que valida que un parámetro no sea mayor al máximo definido.
def test_validate_algorithm_params_rejects_value_above_maximum():
    algorithm_id = "nsga2"
    algorithm_params_raw = '''
    {
        "population_size": 50,
        "generations": 100,
        "mutation_rate": 2
    }
    '''

    with pytest.raises(HTTPException) as exc_info:
        validate_algorithm_params(algorithm_id, algorithm_params_raw)

    assert exc_info.value.status_code == 400
    assert "debe ser menor o igual" in exc_info.value.detail


# Prueba que valida que los parámetros faltantes se completen con valores por defecto.
def test_validate_algorithm_params_uses_default_values_when_missing():
    algorithm_id = "nsga2"
    algorithm_params_raw = "{}"

    selected_algorithm, params = validate_algorithm_params(
        algorithm_id,
        algorithm_params_raw
    )

    assert selected_algorithm["id"] == "nsga2"
    assert "population_size" in params
    assert "generations" in params
    assert "mutation_rate" in params


#------------------ PRUEBAS SEMILLAS ------------------

# Prueba que valida la consistencia de resultados usando la misma semilla.
# Si se usan los mismos datos de entrada y la misma semilla, las soluciones dummy deben ser iguales.
def test_generate_dummy_solutions_same_seed_returns_same_results():
    stations_for_map = [
        {
            "id": "1",
            "station": "SANT",
            "latitude": -33.45,
            "longitude": -70.66
        },
        {
            "id": "2",
            "station": "VALP",
            "latitude": -33.04,
            "longitude": -71.61
        }
    ]

    result_1 = generate_dummy_solutions(
        n_solutions=5,
        n_stations=3,
        stations_for_map=stations_for_map,
        seed=42
    )

    result_2 = generate_dummy_solutions(
        n_solutions=5,
        n_stations=3,
        stations_for_map=stations_for_map,
        seed=42
    )

    assert result_1 == result_2

