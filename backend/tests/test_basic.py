import pytest
from fastapi import HTTPException

from main import validate_positive_integer, process_stations_csv

def test_pytest_funciona():
    assert 1 + 1 == 2

def test_validate_positive_integer_accepts_positive_value():
    validate_positive_integer(
        5,
        "El número de estaciones debe ser mayor que cero"
    )

def test_validate_positive_integer_rejects_zero():
    with pytest.raises(HTTPException) as exc_info:
        validate_positive_integer(
            0,
            "El número de estaciones debe ser mayor que cero"
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El número de estaciones debe ser mayor que cero"

def test_validate_positive_integer_rejects_negative_value():
    with pytest.raises(HTTPException) as exc_info:
        validate_positive_integer(
            -3,
            "El número de estaciones debe ser mayor que cero"
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El número de estaciones debe ser mayor que cero"

def test_process_stations_csv_valid_file():
    csv_content = (
        "ID,STATION,LATITUDE,LONGITUDE\n"
        "1,SANT,-33.45,-70.66\n"
        "2,VALP,-33.04,-71.61\n"
    ).encode("utf-8")

    result = process_stations_csv(csv_content)

    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[0]["station"] == "SANT"
    assert result[0]["latitude"] == -33.45
    assert result[0]["longitude"] == -70.66


def test_process_stations_csv_empty_file():
    csv_content = "".encode("utf-8")

    with pytest.raises(HTTPException) as exc_info:
        process_stations_csv(csv_content)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El archivo de estaciones está vacío"


def test_process_stations_csv_missing_columns():
    csv_content = (
        "ID,STATION,LATITUDE\n"
        "1,SANT,-33.45\n"
    ).encode("utf-8")

    with pytest.raises(HTTPException) as exc_info:
        process_stations_csv(csv_content)

    assert exc_info.value.status_code == 400
    assert "El archivo de estaciones debe contener las columnas" in exc_info.value.detail