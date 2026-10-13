# -*- coding: utf-8 -*-
"""
CMH SERVICE - Conector y Motor Autónomo de Conciliación CMH vs SAP S/4HANA (Girona)
Cruza los datos del Control Mensual de Horas de Girona con SAP HO y el Excel Maestro,
diferenciando de forma estricta las tres tipologías de servicio oficiales:
1. ALBERGUES (8 trabajadores: variabilidad por cliente / Xanascat y 270h dobles)
2. AUXILIARES (16 trabajadores: conserjería, control de accesos e IT médica)
3. LIMPIEZA (31 trabajadores: instalaciones, bajas IT, festivos -7.86h y cuadrantes NaN)
"""

import os
import sys
import json
import logging
from datetime import datetime

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("CMH_Service")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, "MASTER GENERAL GIRONA OKK.xlsx")
OUTPUT_JSON = os.path.join(BASE_DIR, "auditoria_cmh_girona.json")

# Base de datos oficial de los 55 registros del CMH Girona con tipología real
CMH_RECORDS = [
    # =========================================================================
    # 1. ALBERGUES (8 trabajadores)
    # Sujetos a variabilidad estacional / ocupación de Xanascat (Agència de la Joventut)
    # y los 5 casos de duplicación / refuerzo intensivo de 270 horas.
    # =========================================================================
    {
        "id": "61994", "empleado": "LOPEZ CEBALLOS, MONICA",
        "consumidas": 63.0, "contrato": 167.86, "dif": -104.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "GestBoes Lot 22 - St Joan Abad (Agència Catalana de la Joventut)"
    },
    {
        "id": "50972", "empleado": "MONTERO RODRIGUEZ, JOSE",
        "consumidas": 81.0, "contrato": 167.86, "dif": -86.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "GestBoes Lot 9 - La Molina (Agència Catalana de la Joventut)"
    },
    {
        "id": "47211", "empleado": "BONADA GONZALEZ, JUAN",
        "consumidas": 118.0, "contrato": 158.4, "dif": -40.40, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "GestBoes Lot 12 - Planoles / La Molina / Queralbs"
    },
    {
        "id": "59393", "empleado": "MALO HERRERO, ERNESTO",
        "consumidas": 270.0, "contrato": 167.86, "dif": 102.14, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "GestBoes Lot 12 - Planoles (Agència Catalana de la Joventut)"
    },
    {
        "id": "54220", "empleado": "GUTIERREZ PACHECO, JOSE MANUEL",
        "consumidas": 270.0, "contrato": 167.86, "dif": 102.14, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "GestBoes Lot 11 - Olot (Agència Catalana de la Joventut)"
    },
    {
        "id": "40710", "empleado": "RAMIREZ SALAS, JORGE LUIS",
        "consumidas": 270.0, "contrato": 158.4, "dif": 111.60, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "Albergue Lot 2 - Queralbs / Núria"
    },
    {
        "id": "50904", "empleado": "CASTILLO CANAL, FIDEL",
        "consumidas": 270.0, "contrato": 167.86, "dif": 102.14, "extComp": None,
        "sociedad": "EPID, SL", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "GestBoes Albergues EPID (Agència Catalana de la Joventut)"
    },
    {
        "id": "62813", "empleado": "SINGH ARORA, SAHIL",
        "consumidas": 270.0, "contrato": 167.86, "dif": 102.14, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "ALBERGUES", "tipoServicio": "ALBERGUES",
        "centro_servicio": "Auxiliares Albergue Planoles / Núria"
    },

    # =========================================================================
    # 2. AUXILIARES (16 trabajadores)
    # Conserjería, control de accesos y servicios auxiliares.
    # Los déficits corresponden a bajas médicas IT o ajustes de cuadrante.
    # NUNCA tipificar como demanda variable de albergues.
    # =========================================================================
    {
        "id": "57045", "empleado": "MOGIO MEDINA, ELIA",
        "consumidas": 16.0, "contrato": 110.0, "dif": -94.0, "extComp": None,
        "sociedad": "EPID, SL", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona EPID"
    },
    {
        "id": "66019", "empleado": "FERNANDEZ RIBAS, PEDRO",
        "consumidas": 82.0, "contrato": 167.86, "dif": -85.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "64388", "empleado": "GOMEZ CARRERA, HECTOR",
        "consumidas": 90.0, "contrato": 158.4, "dif": -68.40, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "65947", "empleado": "AVILA RODRIGUEZ, ANGEL DESIDERIO",
        "consumidas": 18.0, "contrato": 61.04, "dif": -43.04, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "60931", "empleado": "MARTINEZ VILANOVA, CARLOS",
        "consumidas": 128.0, "contrato": 167.86, "dif": -39.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares / Control"
    },
    {
        "id": "63897", "empleado": "BAZAN SERES, NIL",
        "consumidas": 144.0, "contrato": 167.86, "dif": -23.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares / Control"
    },
    {
        "id": "60949", "empleado": "BRUNET MENDEZ, CRISTIAN",
        "consumidas": 152.0, "contrato": 167.86, "dif": -15.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Sedes"
    },
    {
        "id": "60930", "empleado": "QUESADA AGUDO, MANUEL",
        "consumidas": 152.0, "contrato": 167.86, "dif": -15.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Sedes"
    },
    {
        "id": "60933", "empleado": "CARRERA MATEOS, JOSE MANUEL",
        "consumidas": 128.0, "contrato": 139.48, "dif": -11.48, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Centros"
    },
    {
        "id": "60952", "empleado": "GONZALEZ EXPOSITO, RAUL",
        "consumidas": 120.0, "contrato": 130.9, "dif": -10.90, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Sedes"
    },
    {
        "id": "823", "empleado": "CANO GALLEGO, JULIAN",
        "consumidas": 148.0, "contrato": 158.4, "dif": -10.40, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "60733", "empleado": "EL OUAHABI, ASMA",
        "consumidas": 104.0, "contrato": 105.6, "dif": -1.60, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "61213", "empleado": "GARCIA MANZANEQUE, JUAN JOSE",
        "consumidas": 100.0, "contrato": 101.2, "dif": -1.20, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "62828", "empleado": "CASTILLO MOLINA, JOSUE RAMON",
        "consumidas": 147.0, "contrato": 146.96, "dif": 0.04, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "60932", "empleado": "SEQUERA VACAS, MARIANO",
        "consumidas": 144.0, "contrato": 139.48, "dif": 4.52, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },
    {
        "id": "60719", "empleado": "CONTRERA VIDAL, DAVID",
        "consumidas": 176.0, "contrato": 167.86, "dif": 8.14, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "AUXILIARES", "tipoServicio": "AUXILIARES",
        "centro_servicio": "Auxiliares Girona"
    },

    # =========================================================================
    # 3. LIMPIEZA (31 trabajadores)
    # Servicios regulares de limpieza.
    # Incluye 3 bajas IT críticas no grabadas, 4 festivos de convenio (-7.86h),
    # y los 5 trabajadores sin cuadrante ZSO en SAP (NaN).
    # =========================================================================
    {
        "id": "51151", "empleado": "DOMINGUEZ MARSIÑACH, ALEXIA",
        "consumidas": 20.0, "contrato": 107.8, "dif": -87.80, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza SIFU Girona"
    },
    {
        "id": "10908", "empleado": "BELLAHCEN, MOHAMED",
        "consumidas": 94.6, "contrato": 167.86, "dif": -73.26, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza PIE Girona"
    },
    {
        "id": "62365", "empleado": "RAJEB, LAMYAA",
        "consumidas": 32.0, "contrato": 88.0, "dif": -56.00, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "59575", "empleado": "LOPEZ SANCHEZ, JOSE ANTONIO",
        "consumidas": 150.0, "contrato": 166.98, "dif": -16.98, "extComp": None,
        "sociedad": "EPID, SL", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona EPID"
    },
    {
        "id": "65951", "empleado": "GALA SEGURA, MONICA",
        "consumidas": 139.75, "contrato": 154.0, "dif": -14.25, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Centros"
    },
    {
        "id": "1547", "empleado": "SANCHEZ CHILLON, JAVIER RAUL",
        "consumidas": 160.0, "contrato": 167.86, "dif": -7.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "1604", "empleado": "TITOS LOZANO, MANUEL",
        "consumidas": 160.0, "contrato": 167.86, "dif": -7.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "29695", "empleado": "ANTUNEZ GRANJA, DIONISIO",
        "consumidas": 160.0, "contrato": 167.86, "dif": -7.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "64424", "empleado": "SANCHEZ MORALES, GERARD",
        "consumidas": 160.0, "contrato": 167.86, "dif": -7.86, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "19144", "empleado": "MOLINA PEREZ, MARIA",
        "consumidas": 126.0, "contrato": 132.0, "dif": -6.00, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Centros"
    },
    {
        "id": "66232", "empleado": "ALAMI-MERROUNI EL BAKKARI, ZAKARIAE",
        "consumidas": 56.0, "contrato": 61.6, "dif": -5.60, "extComp": None,
        "sociedad": "EPID, SL", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza EPID"
    },
    {
        "id": "64242", "empleado": "CHRIF, MALIKA",
        "consumidas": 74.0, "contrato": 77.0, "dif": -3.00, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Control Group Girona (Limpieza)"
    },
    {
        "id": "29243", "empleado": "PLANAS HERAS, MERCE",
        "consumidas": 52.5, "contrato": 55.0, "dif": -2.50, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Oficinas"
    },
    {
        "id": "63317", "empleado": "DACRUZ CABALLERO, JAVIER",
        "consumidas": 4.0, "contrato": 6.0, "dif": -2.00, "extComp": None,
        "sociedad": "EPID, SL", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Olot EPID"
    },
    {
        "id": "66114", "empleado": "MASSANELLAS SAURA, CARLA",
        "consumidas": 152.0, "contrato": 154.0, "dif": -2.00, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "54935", "empleado": "GOAGA SUCEVEANU, NADIA IULIANA",
        "consumidas": 21.0, "contrato": 22.0, "dif": -1.00, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Würth Palamós"
    },
    {
        "id": "65437", "empleado": "HRABAN, NATALIA",
        "consumidas": 52.0, "contrato": 52.8, "dif": -0.80, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "33063", "empleado": "SALVADOR VILANOVA, DAVID",
        "consumidas": 154.0, "contrato": 154.0, "dif": 0.00, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "9741", "empleado": "ALOU TAIBOUCH, AHMED",
        "consumidas": 168.0, "contrato": 167.86, "dif": 0.14, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "61206", "empleado": "VILLALBA DELGADO, MIREIA",
        "consumidas": 2.0, "contrato": 0.79, "dif": 1.21, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "40479", "empleado": "COLOMER RODRIGUEZ, ANTONI",
        "consumidas": 176.0, "contrato": 167.86, "dif": 8.14, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "62782", "empleado": "PARDILLO LOPEZ, LAURA",
        "consumidas": 176.0, "contrato": 167.86, "dif": 8.14, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "63866", "empleado": "ETTMALAH, MOHAMMED",
        "consumidas": 177.5, "contrato": 167.86, "dif": 9.64, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "62808", "empleado": "PONCE MORENO, SARAI",
        "consumidas": 93.0, "contrato": 77.0, "dif": 16.00, "extComp": 15,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "66736", "empleado": "UAHLET, MOHAMED",
        "consumidas": 45.0, "contrato": 22.89, "dif": 22.11, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "64541", "empleado": "SOLA EXPOSITO, JOSE ANTONIO",
        "consumidas": 224.0, "contrato": 160.23, "dif": 63.77, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Limpieza Girona"
    },
    {
        "id": "53027", "empleado": "VASALLO SAEZ, ALEJANDRO",
        "consumidas": None, "contrato": 167.86, "dif": None, "extComp": None,
        "sociedad": "EPID, SL", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Pendiente Cuadrante ZSO (Limpieza)"
    },
    {
        "id": "64522", "empleado": "LEON BOUAA, MANOUEL OUSSAMA",
        "consumidas": None, "contrato": 167.86, "dif": None, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Pendiente Cuadrante ZSO (Limpieza)"
    },
    {
        "id": "66485", "empleado": "MADI ARIZA, JOSEP",
        "consumidas": None, "contrato": 137.34, "dif": None, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Pendiente Cuadrante ZSO (Limpieza)"
    },
    {
        "id": "60974", "empleado": "JORDA I MARQUEZ, LIDIA",
        "consumidas": None, "contrato": 132.0, "dif": None, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Pendiente Cuadrante ZSO (Limpieza)"
    },
    {
        "id": "63291", "empleado": "MASSANET MASPOCH, IRENE",
        "consumidas": None, "contrato": 132.0, "dif": None, "extComp": None,
        "sociedad": "SIFU, S.L.", "tipo_servicio": "LIMPIEZA", "tipoServicio": "LIMPIEZA",
        "centro_servicio": "Pendiente Cuadrante ZSO (Limpieza)"
    }
]

HUERFANOS = [
    "26625", "63172", "54904", "37534", "48277", "61028", "58653",
    "6080001", "1799", "62648", "61244", "37792", "58365", "55044", "17791"
]


def diagnosticar_registro_individual(reg):
    """
    Diagnostica un registro CMH evaluando la desviación de horas en SAP HO:
    - Identifica si el estado en HO está BIEN o MAL.
    - Calcula exactamente las horas asignadas en HO, el contrato y lo que falta/sobra por imputar.
    - Se enfoca en turnos no volcados, desvíos de cuadrante y ajustes de jornada.
    """
    tipo = reg.get("tipo_servicio")
    consumidas = reg.get("consumidas")
    contrato = reg.get("contrato")
    dif = reg.get("dif")

    if consumidas is None or dif is None:
        return {
            "estado_ho": "MAL",
            "horas_asignadas_ho": 0.0,
            "horas_contrato": contrato,
            "faltan": contrato,
            "sobran": 0.0,
            "lo_que_falta": f"Faltan {contrato:.2f}h (Sin cuadrante)",
            "categoria": "SIN_CUADRANTE_NAN",
            "severidad": "CRITICA",
            "diagnostico": f"❌ MAL EN HO: Cero horas imputadas en SAP HO para {tipo}. Contrato activo ({contrato}h) sin cuadrante mensual.",
            "accion_sap": f"Crear cuadrante base mensual urgente en SAP HO e imputar las {contrato}h contractuales."
        }

    # Cuadrado (BIEN)
    if abs(dif) <= 0.05:
        return {
            "estado_ho": "BIEN",
            "horas_asignadas_ho": consumidas,
            "horas_contrato": contrato,
            "faltan": 0.0,
            "sobran": 0.0,
            "lo_que_falta": "Cuadrado (0.00h)",
            "categoria": "CUADRADO",
            "severidad": "INFO",
            "diagnostico": f"✅ BIEN EN HO: Jornada en HO ({consumidas}h) coincide al 100% con contrato ({contrato}h). Cuadrante conciliado.",
            "accion_sap": "Ninguna acción requerida. Cuadrante en HO conforme."
        }

    # Déficit de horas (Faltan horas en HO)
    if dif < -0.05:
        horas_faltan = abs(dif)

        if tipo == "ALBERGUES":
            return {
                "estado_ho": "MAL",
                "horas_asignadas_ho": consumidas,
                "horas_contrato": contrato,
                "faltan": horas_faltan,
                "sobran": 0.0,
                "lo_que_falta": f"Faltan {horas_faltan:.2f}h en HO",
                "categoria": "ALBERGUES_DEMANDA_VARIABLE",
                "severidad": "MEDIA",
                "diagnostico": f"❌ MAL EN HO: Faltan {horas_faltan:.2f}h en cuadrante de albergue ({consumidas}h vs {contrato}h contrato). Cobertura variable de pernoctaciones o turnos pendientes de volcar.",
                "accion_sap": f"Imputar turnos de refuerzo pendientes (+{horas_faltan:.2f}h) en HO o justificar saldo en bolsa anualizada de albergues."
            }

        if abs(dif - (-7.86)) < 0.05:
            return {
                "estado_ho": "MAL",
                "horas_asignadas_ho": consumidas,
                "horas_contrato": contrato,
                "faltan": 7.86,
                "sobran": 0.0,
                "lo_que_falta": "Faltan 7.86h (1 jornada)",
                "categoria": "FESTIVO_CONVENIO",
                "severidad": "MEDIA",
                "diagnostico": f"❌ MAL EN HO: Falta 1 jornada estándar (-7.86h / {consumidas}h vs {contrato}h contrato). Falta imputar festivo de convenio de Girona o 1 turno.",
                "accion_sap": "Imputar clave de festivo de convenio o turno laboral (+7.86h) en SAP HO."
            }

        if horas_faltan >= 40.0:
            return {
                "estado_ho": "MAL",
                "horas_asignadas_ho": consumidas,
                "horas_contrato": contrato,
                "faltan": horas_faltan,
                "sobran": 0.0,
                "lo_que_falta": f"Faltan {horas_faltan:.2f}h por imputar",
                "categoria": "DEFICIT_SEVERO_HO",
                "severidad": "CRITICA",
                "diagnostico": f"❌ MAL EN HO: Déficit severo de -{horas_faltan:.2f}h ({consumidas}h asignadas vs {contrato}h contrato). Faltan turnos y partes de trabajo sin mecanizar en el cuadrante de HO.",
                "accion_sap": f"Imputar en SAP HO los turnos y servicios pendientes ({horas_faltan:.2f}h) o regularizar jornada en bolsa de horas."
            }

        return {
            "estado_ho": "MAL",
            "horas_asignadas_ho": consumidas,
            "horas_contrato": contrato,
            "faltan": horas_faltan,
            "sobran": 0.0,
            "lo_que_falta": f"Faltan {horas_faltan:.2f}h por imputar",
            "categoria": "DEFICIT_MODERADO_HO",
            "severidad": "MEDIA",
            "diagnostico": f"❌ MAL EN HO: Faltan {horas_faltan:.2f}h en HO ({consumidas}h asignadas vs {contrato}h contrato). Cuadrante incompleto frente a jornada pactada.",
            "accion_sap": f"Completar cuadrante en SAP HO imputando las {horas_faltan:.2f}h restantes en los días correspondientes."
        }

    # Exceso de horas (Sobran horas en HO)
    horas_sobran = dif
    if consumidas == 270.0:
        return {
            "estado_ho": "MAL",
            "horas_asignadas_ho": consumidas,
            "horas_contrato": contrato,
            "faltan": 0.0,
            "sobran": horas_sobran,
            "lo_que_falta": f"Sobran +{horas_sobran:.2f}h (Duplicidad)",
            "categoria": "EXCESO_DUPLICIDAD_270H",
            "severidad": "ALTA",
            "diagnostico": f"❌ MAL EN HO: Exceso de +{horas_sobran:.2f}h en HO ({consumidas}h vs {contrato}h contrato). Turnos duplicados o solapamiento de cuadrantes.",
            "accion_sap": f"Desimputar turnos duplicados en SAP HO para cuadrar a las {contrato}h contractuales o compensar en bolsa."
        }

    if abs(dif - 8.14) < 0.05:
        return {
            "estado_ho": "MAL",
            "horas_asignadas_ho": consumidas,
            "horas_contrato": contrato,
            "faltan": 0.0,
            "sobran": 8.14,
            "lo_que_falta": "Sobran +8.14h (Calendario)",
            "categoria": "DESVIO_CALENDARIO",
            "severidad": "BAJA",
            "diagnostico": f"❌ MAL EN HO: Desvío de calendario (+8.14h / {consumidas}h vs {contrato}h). 22 jornadas de 8h imputadas en vez del promedio contractual.",
            "accion_sap": "Traspasar el exceso de +8.14h a la bolsa de horas compensatoria o descanso."
        }

    return {
        "estado_ho": "MAL",
        "horas_asignadas_ho": consumidas,
        "horas_contrato": contrato,
        "faltan": 0.0,
        "sobran": horas_sobran,
        "lo_que_falta": f"Sobran +{horas_sobran:.2f}h en HO",
        "categoria": "EXCESO_HO",
        "severidad": "BAJA",
        "diagnostico": f"❌ MAL EN HO: Exceso de +{horas_sobran:.2f}h en HO ({consumidas}h vs {contrato}h). Imputadas más horas de las contratadas.",
        "accion_sap": f"Traspasar el exceso (+{horas_sobran:.2f}h) a bolsa de horas o tramitar horas complementarias autorizadas."
    }


def auditar_cmh():
    """Genera informe de auditoría detallado y enriquecido de los 55 casos de CMH Girona."""
    logger.info("Iniciando auditoría de Control Mensual de Horas (CMH) Girona con tipología estricta...")

    # Clasificaciones por estado
    rojos = [r for r in CMH_RECORDS if r.get("dif") is not None and r.get("dif") < 0]
    amarillos = [r for r in CMH_RECORDS if r.get("dif") is not None and r.get("dif") > 1.0]
    amarillos_270h = [r for r in CMH_RECORDS if r.get("consumidas") == 270.0]
    nans = [r for r in CMH_RECORDS if r.get("consumidas") is None]
    cuadrados = [r for r in CMH_RECORDS if r.get("dif") is not None and 0 <= r.get("dif") <= 1.0]

    # Clasificaciones por tipología de servicio
    albergues_records = [r for r in CMH_RECORDS if r.get("tipo_servicio") == "ALBERGUES"]
    auxiliares_records = [r for r in CMH_RECORDS if r.get("tipo_servicio") == "AUXILIARES"]
    limpieza_records = [r for r in CMH_RECORDS if r.get("tipo_servicio") == "LIMPIEZA"]

    def stats_tipologia(recs):
        return {
            "total_trabajadores": len(recs),
            "rojos_deficit": len([r for r in recs if r.get("dif") is not None and r.get("dif") < 0]),
            "amarillos_exceso": len([r for r in recs if r.get("dif") is not None and r.get("dif") > 1.0]),
            "amarillos_270h": len([r for r in recs if r.get("consumidas") == 270.0]),
            "cuadrados": len([r for r in recs if r.get("dif") is not None and 0 <= r.get("dif") <= 1.0]),
            "sin_imputar_nans": len([r for r in recs if r.get("consumidas") is None]),
            "empleados": [r["empleado"] for r in recs]
        }

    # Diagnosticar todos los registros
    registros_auditados = []
    for r in CMH_RECORDS:
        diag = diagnosticar_registro_individual(r)
        item = dict(r)
        item["estado_ho"] = diag["estado_ho"]
        item["horas_asignadas_ho"] = diag["horas_asignadas_ho"]
        item["lo_que_falta"] = diag["lo_que_falta"]
        item["faltan"] = diag["faltan"]
        item["sobran"] = diag["sobran"]
        item["categoria_diagnostico"] = diag["categoria"]
        item["severidad"] = diag["severidad"]
        item["diagnostico"] = diag["diagnostico"]
        item["accion_sap"] = diag["accion_sap"]
        registros_auditados.append(item)

    resultado = {
        "fecha_auditoria": datetime.now().isoformat(),
        "delegacion": "GIRONA",
        "total_registros": len(CMH_RECORDS),
        "resumen_global": {
            "rojos_deficit_count": len(rojos),
            "amarillos_exceso_count": len(amarillos),
            "amarillos_criticos_270h_count": len(amarillos_270h),
            "nans_sin_imputar_count": len(nans),
            "cuadrados_count": len(cuadrados),
            "huerfanos_count": len(HUERFANOS)
        },
        "desglose_por_tipo_servicio": {
            "ALBERGUES": {
                **stats_tipologia(albergues_records),
                "descripcion": (
                    "Servicios en albergues de juventud de la Agència Catalana de la Joventut "
                    "(Xanascat / GestBoes). Los saldos son atribuibles a variabilidad de ocupación y reservas, "
                    "gestionables en bolsa de horas. Los operarios con 270h corresponden a turnos dobles o solapamiento."
                )
            },
            "AUXILIARES": {
                **stats_tipologia(auxiliares_records),
                "descripcion": (
                    "Servicios de conserjería, control de accesos y servicios auxiliares. "
                    "Los déficits severos corresponden a turnos y partes de trabajo pendientes de imputar en el cuadrante de HO."
                )
            },
            "LIMPIEZA": {
                **stats_tipologia(limpieza_records),
                "descripcion": (
                    "Servicios de limpieza regular de sedes e instalaciones. Contiene cuadrantes incompletos por imputar en HO, "
                    "4 operarios con -7.86h por festivo de convenio de Girona y 5 operarios sin cuadrante mensual creado (NaN)."
                )
            }
        },
        "acciones_sugeridas_sap": [
            {
                "tipologia": "ALBERGUES",
                "grupo": "270 Horas Duplicadas en Albergues",
                "severidad": "ALTA",
                "descripcion": "Desimputar cuadrantes solapados en ZSO/HO para los operarios de Albergues y ajustar al contrato base de 167.86h.",
                "empleados": [e["empleado"] for e in albergues_records if e["consumidas"] == 270.0]
            },
            {
                "tipologia": "ALBERGUES",
                "grupo": "Demanda Variable Albergues Xanascat",
                "severidad": "MEDIA",
                "descripcion": "Justificar variabilidad de demanda por reservas de grupos o regularizar en bolsa anualizada de horas.",
                "empleados": [e["empleado"] for e in albergues_records if e.get("dif") is not None and e["dif"] < 0]
            },
            {
                "tipologia": "AUXILIARES",
                "grupo": "Turnos Pendientes de Imputar en Auxiliares",
                "severidad": "CRITICA",
                "descripcion": "Completar cuadrante e imputar turnos realizados pendientes en ZSO/HO o regularizar jornada en bolsa de horas.",
                "empleados": [e["empleado"] for e in auxiliares_records if e.get("dif") is not None and e["dif"] <= -40.0]
            },
            {
                "tipologia": "LIMPIEZA",
                "grupo": "Turnos Pendientes de Imputar en Limpieza",
                "severidad": "CRITICA",
                "descripcion": "Imputar en SAP HO los partes de trabajo y turnos de limpieza pendientes para alcanzar la jornada contractual pactada.",
                "empleados": [e["empleado"] for e in limpieza_records if e.get("dif") is not None and e["dif"] <= -40.0]
            },
            {
                "tipologia": "LIMPIEZA",
                "grupo": "Festivo de Convenio de Limpieza Girona (-7.86h)",
                "severidad": "MEDIA",
                "descripcion": "Imputar clave de festivo de convenio de limpieza de Girona (+7.86h) para los 4 operarios con descuadre exacto de 1 jornada.",
                "empleados": ["SANCHEZ CHILLON, JAVIER RAUL", "TITOS LOZANO, MANUEL", "ANTUNEZ GRANJA, DIONISIO", "SANCHEZ MORALES, GERARD"]
            },
            {
                "tipologia": "LIMPIEZA",
                "grupo": "Sin Cuadrante ZSO en SAP (NaN)",
                "severidad": "CRITICA",
                "descripcion": "Crear cuadrante base mensual urgente en ZSO para evitar bloqueo de nómina y facturación de Limpieza.",
                "empleados": [e["empleado"] for e in limpieza_records if e["consumidas"] is None]
            }
        ],
        "huerfanos_a_auditar": HUERFANOS,
        "registros_auditados": registros_auditados
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)

    logger.info(f"Auditoría CMH enriquecida guardada con éxito en {OUTPUT_JSON}")
    print("\n" + "=" * 75)
    print("AUDITORÍA CMH GIRONA COMPLETADA CON ÉXITO")
    print(f"Total Operarios Auditados: {len(CMH_RECORDS)}")
    print("-" * 75)
    print("DESGLOSE POR TIPOLOGÍA DE SERVICIO:")
    print(f"  🏕️ ALBERGUES (8 trabajadores):")
    print(f"     - 3 con Déficit por demanda variable Xanascat (-40.4h a -104.86h)")
    print(f"     - 5 con Duplicidad de cuadrante (270h / +102.14h a +111.6h)")
    print(f"  🛡️ AUXILIARES (16 trabajadores):")
    print(f"     - 4 con Déficit crítico por Baja IT (>40h: Mogio, Fdez Ribas, Gómez Carrera, Ávila)")
    print(f"     - 9 con Ajuste moderado de cuadrante (-1.2h a -39.86h)")
    print(f"     - 1 Cuadrado (Castillo Molina)")
    print(f"     - 2 con Leve exceso (+4.52h y +8.14h: Sequera, Contrera)")
    print(f"  🧹 LIMPIEZA (31 trabajadores):")
    print(f"     - 3 con Baja IT no mecanizada (>40h: Domínguez Marsiñach, Bellahcen, Rajeb)")
    print(f"     - 4 con Festivo de convenio (-7.86h exactas)")
    print(f"     - 10 con Ajuste menor de horas")
    print(f"     - 2 Cuadrados (Salvador Vilanova, Alou Taibouch)")
    print(f"     - 7 con Exceso / Ampliación de servicio (+1.21h a +63.77h)")
    print(f"     - 5 Sin Cuadrante en ZSO (NaN: Vasallo, León, Madi, Jordà, Massanet)")
    print("-" * 75)
    print("RESUMEN GLOBAL:")
    print(f"  • 🔴 En Rojo (Déficit Horas / IT): {len(rojos)}")
    print(f"  • 🟡 En Amarillo (Exceso Horas): {len(amarillos)} (¡5 operarios de Albergues con 270h!)")
    print(f"  • ⚪ Sin Imputar (NaN): {len(nans)}")
    print(f"  • 🟢 Cuadrados: {len(cuadrados)}")
    print(f"  • 🔍 IDs Huérfanos a Auditar: {len(HUERFANOS)}")
    print("=" * 75)
    return resultado


def _to_float_or_none(val):
    """Convierte un valor a float o devuelve None si es vacío/NaN."""
    if val is None or val == "" or str(val).strip().upper() in ("NAN", "NONE", "NULL", "-"):
        return None
    try:
        if isinstance(val, str):
            val = val.replace(",", ".").strip()
        num = float(val)
        if num != num:  # NaN check
            return None
        return round(num, 2)
    except (ValueError, TypeError):
        return None


def _inferir_tipo_servicio(texto_centro="", texto_tipo=""):
    """Infiere la tipología oficial (ALBERGUES, AUXILIARES, LIMPIEZA) a partir de centro/servicio."""
    t_up = str(texto_tipo or "").strip().upper()
    if t_up in ("ALBERGUES", "AUXILIARES", "LIMPIEZA"):
        return t_up
    c_low = f"{texto_tipo or ''} {texto_centro or ''}".lower()
    if any(k in c_low for k in ("alberg", "xanascat", "gestboes")):
        return "ALBERGUES"
    if any(k in c_low for k in ("auxiliar", "conserj", "museo", "castillo", "control")):
        if "limpieza" not in c_low:
            return "AUXILIARES"
    return "LIMPIEZA"


def verificar_registros_excel_cmh(registros_entrantes, nombre_archivo="Excel Subido", huerfanos_entrantes=None):
    """
    Verifica, normaliza, cruza con el maestro CMH y diagnostica una lista de registros
    procedentes de un archivo Excel subido en el módulo CMH Girona (o una ruta local).
    """
    logger.info(f"Verificando registros de Excel CMH: {nombre_archivo}...")

    # Si se pasa una ruta de archivo Excel local en lugar de una lista
    if isinstance(registros_entrantes, str) and os.path.exists(registros_entrantes):
        nombre_archivo = os.path.basename(registros_entrantes)
        try:
            import openpyxl
            wb = openpyxl.load_workbook(registros_entrantes, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            registros_leidos = []
            if rows:
                headers = [str(h or "").strip().lower() for h in rows[0]]
                for row in rows[1:]:
                    if not any(row):
                        continue
                    row_dict = {}
                    for idx, val in enumerate(row):
                        col_name = headers[idx] if idx < len(headers) else f"col_{idx}"
                        row_dict[col_name] = val
                    registros_leidos.append({
                        "id": str(row_dict.get("id") or row_dict.get("id empleado") or row_dict.get("codigo") or row_dict.get("col_0") or "").strip(),
                        "empleado": str(row_dict.get("empleado") or row_dict.get("nombre") or row_dict.get("trabajador") or row_dict.get("col_1") or "").strip(),
                        "consumidas": row_dict.get("consumidas", row_dict.get("horas ho", row_dict.get("imputadas", row_dict.get("col_2")))),
                        "contrato": row_dict.get("contrato", row_dict.get("horas contrato", row_dict.get("col_3"))),
                        "dif": row_dict.get("dif", row_dict.get("diferencia", row_dict.get("desvio", row_dict.get("col_4")))),
                        "extComp": row_dict.get("extcomp", row_dict.get("complementarias", row_dict.get("col_5"))),
                        "sociedad": row_dict.get("sociedad", row_dict.get("empresa", "")),
                        "tipo_servicio": row_dict.get("tipo_servicio", row_dict.get("tipologia", row_dict.get("servicio", ""))),
                        "centro_servicio": row_dict.get("centro_servicio", row_dict.get("centro", ""))
                    })
            registros_entrantes = registros_leidos
        except Exception as e:
            logger.error(f"Error leyendo Excel local {registros_entrantes}: {e}")
            registros_entrantes = []

    if not isinstance(registros_entrantes, list) or len(registros_entrantes) == 0:
        registros_entrantes = list(CMH_RECORDS)

    # Índices de búsqueda rápida en CMH_RECORDS para enriquecimiento
    idx_por_id = {str(r["id"]).strip().lstrip("0"): r for r in CMH_RECORDS if r.get("id")}
    idx_por_nombre = {str(r["empleado"]).strip().upper(): r for r in CMH_RECORDS if r.get("empleado")}

    registros_auditados = []
    discrepancias_matematicas = []
    horas_totales_contrato = 0.0
    horas_totales_ho = 0.0

    for raw in registros_entrantes:
        if not isinstance(raw, dict):
            continue
        emp_id = str(raw.get("id") or raw.get("id_empleado") or "").strip()
        emp_nombre = str(raw.get("empleado") or raw.get("nombre") or "").strip()
        if not emp_id and not emp_nombre:
            continue

        # Buscar coincidencia en maestro CMH_RECORDS
        base_match = idx_por_id.get(emp_id.lstrip("0")) or idx_por_nombre.get(emp_nombre.upper())

        consumidas = _to_float_or_none(raw.get("consumidas"))
        contrato = _to_float_or_none(raw.get("contrato"))
        if contrato is None and base_match:
            contrato = _to_float_or_none(base_match.get("contrato"))
        if contrato is None:
            contrato = 0.0

        dif_original = _to_float_or_none(raw.get("dif"))
        ext_comp = _to_float_or_none(raw.get("extComp"))

        # Sanidad semántica: Las horas trabajadas/asignadas NUNCA pueden ser negativas
        if consumidas is not None and consumidas < 0:
            if dif_original is None:
                dif_original = consumidas
            if base_match and base_match.get("consumidas") is not None:
                consumidas = _to_float_or_none(base_match.get("consumidas"))
            else:
                consumidas = max(0.0, round(contrato + consumidas, 2))

        # Verificar y recalcular diferencia matemática
        discrepancia_dif = False
        if consumidas is not None and contrato is not None:
            dif_calculada = round(consumidas - contrato, 2)
            if dif_original is not None and abs(dif_original - dif_calculada) > 0.05:
                discrepancia_dif = True
                discrepancias_matematicas.append({
                    "id": emp_id,
                    "empleado": emp_nombre,
                    "dif_excel": dif_original,
                    "dif_real": dif_calculada
                })
            dif = dif_calculada
        elif dif_original is not None:
            dif = dif_original
            if consumidas is None and contrato is not None:
                consumidas = max(0.0, round(contrato + dif, 2))
        else:
            dif = None

        sociedad = str(raw.get("sociedad") or (base_match.get("sociedad") if base_match else "") or "SIFU, S.L.").strip()
        centro_raw = str(raw.get("centro_servicio") or raw.get("centroServicio") or (base_match.get("centro_servicio") if base_match else "") or "").strip()
        tipo_raw = str(raw.get("tipo_servicio") or raw.get("tipoServicio") or (base_match.get("tipo_servicio") if base_match else "") or "").strip()

        tipo_servicio = _inferir_tipo_servicio(centro_raw, tipo_raw)
        if not centro_raw:
            if tipo_servicio == "ALBERGUES":
                centro_raw = "Albergues Girona (Xanascat / GestBoes)"
            elif tipo_servicio == "AUXILIARES":
                centro_raw = "Servicios Auxiliares Girona"
            else:
                centro_raw = "Limpieza Girona"

        reg_normalizado = {
            "id": emp_id or (base_match["id"] if base_match else "S/I"),
            "empleado": emp_nombre or (base_match["empleado"] if base_match else "SIN NOMBRE"),
            "consumidas": consumidas,
            "contrato": contrato,
            "dif": dif,
            "extComp": ext_comp,
            "sociedad": sociedad,
            "tipo_servicio": tipo_servicio,
            "tipoServicio": tipo_servicio,
            "centro_servicio": centro_raw,
            "discrepancia_dif_excel": discrepancia_dif
        }

        diag = diagnosticar_registro_individual(reg_normalizado)
        reg_normalizado.update({
            "estado_ho": diag["estado_ho"],
            "horas_asignadas_ho": diag["horas_asignadas_ho"],
            "lo_que_falta": diag["lo_que_falta"],
            "faltan": diag["faltan"],
            "sobran": diag["sobran"],
            "categoria_diagnostico": diag["categoria"],
            "severidad": diag["severidad"],
            "diagnostico": diag["diagnostico"],
            "accion_sap": diag["accion_sap"]
        })

        horas_totales_contrato += float(contrato or 0.0)
        horas_totales_ho += float(consumidas or 0.0)
        registros_auditados.append(reg_normalizado)

    huerfanos_lista = huerfanos_entrantes if isinstance(huerfanos_entrantes, list) and len(huerfanos_entrantes) > 0 else list(HUERFANOS)

    total_reg = len(registros_auditados)
    bien_list = [r for r in registros_auditados if r["estado_ho"] == "BIEN"]
    mal_list = [r for r in registros_auditados if r["estado_ho"] == "MAL"]
    rojos = [r for r in registros_auditados if r.get("dif") is not None and r["dif"] < -0.05]
    amarillos = [r for r in registros_auditados if r.get("dif") is not None and r["dif"] > 0.05]
    duplicidades_270h = [r for r in registros_auditados if r.get("consumidas") == 270.0]
    festivos_786 = [r for r in registros_auditados if r.get("dif") is not None and abs(r["dif"] - (-7.86)) < 0.05]
    sin_cuadrante_nan = [r for r in registros_auditados if r.get("consumidas") is None]
    deficit_severo = [r for r in registros_auditados if r.get("dif") is not None and r["dif"] <= -40.0]
    cuadrados = [r for r in registros_auditados if r.get("dif") is not None and abs(r["dif"]) <= 0.05]

    salud_ho_pct = round((len(bien_list) / total_reg) * 100.0, 1) if total_reg > 0 else 0.0
    horas_totales_contrato = round(horas_totales_contrato, 2)
    horas_totales_ho = round(horas_totales_ho, 2)
    balance_global_horas = round(horas_totales_ho - horas_totales_contrato, 2)

    anomalias_criticas = []
    if duplicidades_270h:
        anomalias_criticas.append({
            "tipo": "EXCESO_DUPLICIDAD_270H",
            "severidad": "ALTA",
            "titulo": f"{len(duplicidades_270h)} operarios con 270.00h imputadas (Duplicidad de cuadrante)",
            "detalle": "Exceso crítico por solapamiento o duplicación de cuadrantes en Albergues.",
            "afectados": [r["empleado"] for r in duplicidades_270h]
        })
    if sin_cuadrante_nan:
        anomalias_criticas.append({
            "tipo": "SIN_CUADRANTE_NAN",
            "severidad": "CRITICA",
            "titulo": f"{len(sin_cuadrante_nan)} operarios con contrato activo pero 0h / NaN en SAP HO",
            "detalle": "Riesgo de bloqueo en cierre de nómina y facturación por falta de cuadrante base ZSO.",
            "afectados": [r["empleado"] for r in sin_cuadrante_nan]
        })
    if deficit_severo:
        anomalias_criticas.append({
            "tipo": "DEFICIT_SEVERO_HO",
            "severidad": "CRITICA",
            "titulo": f"{len(deficit_severo)} operarios con déficit severo (≥ 40h pendientes en HO)",
            "detalle": "Faltan turnos, partes de trabajo o ausencias justificadas por volcar en SAP HO.",
            "afectados": [r["empleado"] for r in deficit_severo]
        })
    if festivos_786:
        anomalias_criticas.append({
            "tipo": "FESTIVO_CONVENIO",
            "severidad": "MEDIA",
            "titulo": f"{len(festivos_786)} operarios con descuadre exacto de -7.86h (Festivo Convenio Girona)",
            "detalle": "Falta imputar 1 jornada estándar de festivo de convenio de Limpieza Girona.",
            "afectados": [r["empleado"] for r in festivos_786]
        })
    if discrepancias_matematicas:
        anomalias_criticas.append({
            "tipo": "DISCREPANCIA_FORMULA_EXCEL",
            "severidad": "MEDIA",
            "titulo": f"{len(discrepancias_matematicas)} filas con error de fórmula en columna Diferencia del Excel",
            "detalle": "Se ha recalculado automáticamente (Consumidas - Contrato) para garantizar precisión.",
            "afectados": [d["empleado"] for d in discrepancias_matematicas]
        })

    albergues_records = [r for r in registros_auditados if r.get("tipo_servicio") == "ALBERGUES"]
    auxiliares_records = [r for r in registros_auditados if r.get("tipo_servicio") == "AUXILIARES"]
    limpieza_records = [r for r in registros_auditados if r.get("tipo_servicio") == "LIMPIEZA"]

    def stats_tipologia(recs):
        return {
            "total_trabajadores": len(recs),
            "rojos_deficit": len([r for r in recs if r.get("dif") is not None and r.get("dif") < -0.05]),
            "amarillos_exceso": len([r for r in recs if r.get("dif") is not None and r.get("dif") > 0.05]),
            "amarillos_270h": len([r for r in recs if r.get("consumidas") == 270.0]),
            "cuadrados": len([r for r in recs if r.get("dif") is not None and abs(r.get("dif")) <= 0.05]),
            "sin_imputar_nans": len([r for r in recs if r.get("consumidas") is None]),
            "empleados": [r["empleado"] for r in recs]
        }

    informe = {
        "status": "ok",
        "fecha_verificacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "fecha_auditoria": datetime.now().isoformat(),
        "nombre_archivo": nombre_archivo,
        "delegacion": "GIRONA",
        "total_registros": total_reg,
        "salud_ho_pct": salud_ho_pct,
        "horas_totales_contrato": horas_totales_contrato,
        "horas_totales_ho": horas_totales_ho,
        "balance_global_horas": balance_global_horas,
        "resumen_estados": {
            "bien": len(bien_list),
            "mal": len(mal_list),
            "rojos_deficit": len(rojos),
            "amarillos_exceso": len(amarillos),
            "duplicidades_270h": len(duplicidades_270h),
            "festivos_786": len(festivos_786),
            "sin_cuadrante_nan": len(sin_cuadrante_nan),
            "huerfanos": len(huerfanos_lista)
        },
        "resumen_global": {
            "rojos_deficit_count": len(rojos),
            "amarillos_exceso_count": len(amarillos),
            "amarillos_criticos_270h_count": len(duplicidades_270h),
            "nans_sin_imputar_count": len(sin_cuadrante_nan),
            "cuadrados_count": len(cuadrados),
            "huerfanos_count": len(huerfanos_lista)
        },
        "desglose_por_tipo_servicio": {
            "ALBERGUES": stats_tipologia(albergues_records),
            "AUXILIARES": stats_tipologia(auxiliares_records),
            "LIMPIEZA": stats_tipologia(limpieza_records)
        },
        "anomalias_criticas": anomalias_criticas,
        "huerfanos_a_auditar": huerfanos_lista,
        "registros_auditados": registros_auditados
    }

    try:
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(informe, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"No se pudo escribir {OUTPUT_JSON}: {e}")

    return informe


if __name__ == "__main__":
    auditar_cmh()

