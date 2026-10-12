# -*- coding: utf-8 -*-
"""
SIFU MASTER WATCHER v5.0 (GIRONA)
Vigilante inteligente de autoguardado en tiempo real.
Detecta cuando guardas el Excel (Ctrl+S) y actualiza la aplicación web al instante.
"""

import os
import sys
import time
import shutil
from datetime import datetime
from extract_excel import extract, EXCEL_PATH, BASE_DIR

# Forzar encoding UTF-8 en stdout y stderr
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True, errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', line_buffering=True, errors='replace')
except Exception:
    pass

# Rutas adicionales donde el usuario podria guardar el Excel
ALTERNATIVE_PATHS = [
    os.path.join(r"C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\SIFU -OP\SIFU GIRONA", "MASTER GENERAL GIRONA OKK.xlsx"),
    os.path.join(r"C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\ALEX\APP SIFU GIRONA", "MASTER GENERAL GIRONA OKK.xlsx")
]

def get_file_sig(path):
    """Devuelve (mtime, size) del archivo para detectar modificaciones."""
    try:
        if os.path.exists(path):
            st = os.stat(path)
            return (round(st.st_mtime, 2), st.st_size)
    except Exception:
        pass
    return None

def print_banner():
    if sys.stdout.isatty():
        os.system("cls" if os.name == "nt" else "clear")
    print("=" * 64, flush=True)
    print("   SIFU INTELLIGENCE - AUTOGUARDADO EN TIEMPO REAL v5.0", flush=True)
    print("=" * 64, flush=True)
    print(" ESTADO:  ACTIVO Y VIGILANDO EN SEGUNDO PLANO", flush=True)
    print(f" ARCHIVO: MASTER GENERAL GIRONA OKK.xlsx", flush=True)
    print(f" RUTA:    {EXCEL_PATH}", flush=True)
    print("=" * 64, flush=True)
    print(" [Edita y guarda tu Excel normalmente (Ctrl+S). Toda la app web", flush=True)
    print("  se actualizara automaticamente en menos de 1 segundo]", flush=True)
    print("=" * 64, flush=True)
    print("", flush=True)

def main():
    print_banner()

    # Sincronización inicial con SAP HO y Excel Maestro
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [INICIO] Sincronizacion inicial del sistema HO ↔ Excel...", flush=True)
    try:
        from ho_master_sync import HOMasterSynchronizer
        syncer = HOMasterSynchronizer()
        syncer.sync(update_excel_file=True)
    except Exception as e_init:
        print(f"[WARN] Sincro HO inicial diferida: {e_init}", flush=True)
        extract(EXCEL_PATH)
    
    last_main_sig = get_file_sig(EXCEL_PATH)
    last_alt_sigs = {}
    for p in ALTERNATIVE_PATHS:
        if os.path.exists(p):
            last_alt_sigs[p] = get_file_sig(p)

    print(f"[{datetime.now().strftime('%H:%M:%S')}] [LISTO] Vigilante activo. Esperando cambios en Excel...\n", flush=True)

    counter = 0

    while True:
        try:
            time.sleep(1.0)
            counter += 1

            # 1. Comprobar el archivo principal
            curr_sig = get_file_sig(EXCEL_PATH)
            if curr_sig and curr_sig != last_main_sig:
                time.sleep(0.4)
                now_str = datetime.now().strftime('%H:%M:%S')
                print(f"[{now_str}] [CAMBIO DETECTADO] Guardado en MASTER GENERAL GIRONA OKK.xlsx", flush=True)
                if extract(EXCEL_PATH):
                    last_main_sig = get_file_sig(EXCEL_PATH)
                    print(f"[{now_str}] [EXITO] Informacion sincronizada y autoguardada con exito!\n", flush=True)
                    try:
                        from ho_master_sync import HOMasterSynchronizer
                        syncer = HOMasterSynchronizer()
                        syncer.enrich_master_data_js()
                    except Exception as e_enrich:
                        pass
                    try:
                        from supervisor_engine import SupervisorVirtual
                        sup = SupervisorVirtual(autonomy_level=2)
                        if sup.load_master_data():
                            sup.analyze_operations()
                            print(f"[{now_str}] [SUPERVISOR] Analisis operativo y conexion HO actualizados.", flush=True)
                    except Exception as e_sup:
                        pass
                continue

            # 2. Comprobar rutas secundarias
            for alt_path in ALTERNATIVE_PATHS:
                alt_sig = get_file_sig(alt_path)
                prev_alt_sig = last_alt_sigs.get(alt_path)
                if alt_sig and prev_alt_sig and alt_sig != prev_alt_sig:
                    time.sleep(0.4)
                    now_str = datetime.now().strftime('%H:%M:%S')
                    print(f"[{now_str}] [CAMBIO EXTERNO] Detectado en: {alt_path}", flush=True)
                    try:
                        shutil.copy2(alt_path, EXCEL_PATH)
                        print(f"[{now_str}] [COPIA] Archivo copiado a la ruta de trabajo.", flush=True)
                    except Exception as e:
                        print(f"[{now_str}] [AVISO] Error al copiar: {e}", flush=True)

                    if extract(EXCEL_PATH):
                        last_main_sig = get_file_sig(EXCEL_PATH)
                        last_alt_sigs[alt_path] = get_file_sig(alt_path)
                        print(f"[{now_str}] [EXITO] Informacion sincronizada y autoguardada con exito!\n", flush=True)
                    break

            if counter % 60 == 0:
                now_str = datetime.now().strftime('%H:%M:%S')
                print(f"[{now_str}] [LATIDO] Monitor activo (esperando Ctrl+S en Excel...)", flush=True)

        except KeyboardInterrupt:
            print("\n[INFO] Monitor detenido por el usuario.", flush=True)
            break
        except Exception as e:
            print(f"[AVISO] Error en ciclo de vigilancia: {e}", flush=True)
            time.sleep(1.0)

if __name__ == "__main__":
    main()
