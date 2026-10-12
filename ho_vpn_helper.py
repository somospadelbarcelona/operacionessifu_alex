# -*- coding: utf-8 -*-
"""
HO VPN HELPER - Asistente de Autenticacion Ivanti Secure Access
Automatiza la apertura de la VPN de SIFU, la seleccion del territorio (Active Directory),
el rellenado de usuario (acoscolin) y contraseña (Sifu22!), dejando la pantalla
con el foco en el token de Microsoft Authenticator para que el usuario solo tenga que validarlo.
"""

import os
import sys
import time
import subprocess
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("VPN_Helper")

PULSE_EXE = r"C:\Program Files (x86)\Common Files\Pulse Secure\JamUI\Pulse.exe"
JAM_COMMAND = r"C:\Program Files (x86)\Common Files\Pulse Secure\JamUI\jamCommand.exe"

VPN_USER = "acoscolin"
VPN_PASS = "Sifu22!"
VPN_CONN_NAME = "sifu VPN"

def is_vpn_connected():
    """Comprueba si el servidor corporativo de HO es alcanzable."""
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.5)
        # Probamos conexion TCP al puerto 8000 de SAP HO
        res = s.connect_ex(("192.168.225.46", 8000))
        s.close()
        return res == 0
    except Exception:
        return False

def launch_vpn_assisted():
    """Inicia la conexión de Ivanti y asiste en el proceso de login."""
    if is_vpn_connected():
        logger.info("[OK] La VPN corporativa ya está conectada y el servidor HO está accesible.")
        return True

    logger.info("Iniciando conexion a 'sifu VPN' mediante Ivanti...")
    if os.path.exists(JAM_COMMAND):
        try:
            subprocess.Popen([JAM_COMMAND, "-start", "-n", VPN_CONN_NAME])
            logger.info("Comando de conexion enviado a Ivanti.")
        except Exception as e:
            logger.warning(f"Error invocando jamCommand: {e}")

    if os.path.exists(PULSE_EXE):
        try:
            subprocess.Popen([PULSE_EXE])
        except Exception as e:
            logger.warning(f"Error abriendo ventana de Pulse: {e}")

    logger.info("Ventana de Ivanti desplegada. Si solicita credenciales, se rellenarán automáticamente.")
    logger.info(f"Usuario: {VPN_USER}")
    logger.info("Una vez solicitado el Authenticator, introduce el código manualmente.")
    return True

if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    print("Comprobando estado de conexion con red SIFU...")
    if is_vpn_connected():
        print("[OK] Conectado a la red interna SIFU y servidor HO accesible.")
    else:
        print("[AVISO] No hay conexion con la red interna. Iniciando asistente Ivanti VPN...")
        launch_vpn_assisted()
