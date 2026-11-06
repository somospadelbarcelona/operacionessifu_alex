import os
import re

bcn_file = "build_bcn_contraste.py"
with open(bcn_file, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Cargar Cuadrantes Activos y Catálogo de Proyectos antes del paso 5
quad_load_code = '''    # 4.5. Cargar Cuadrantes Activos de SAP HO y Catálogo de Proyectos para validación autónoma
    quad_map = {}
    all_quad_workers = set()
    if os.path.exists(HO_CUADRANTES_FILE):
        try:
            with open(HO_CUADRANTES_FILE, "r", encoding="utf-8") as f_q:
                cuad_raw = json.load(f_q)
            for pid, pdata in cuad_raw.get("projects", {}).items():
                m_p = re.search(r'(PROY\\d+|SVO\\d+|PGOC\\d+|PIEC\\d+)', pid)
                base_p = m_p.group(1) if m_p else pid
                if base_p not in quad_map: quad_map[base_p] = set()
                if pid not in quad_map: quad_map[pid] = set()
                for t in pdata.get("turnos", []):
                    for e in t.get("empleados", []):
                        eid_clean = str(e.get("id_empleado") or "").strip().lstrip("0")
                        nom_clean = normalize_name(e.get("nombre"))
                        if eid_clean:
                            quad_map[base_p].add(eid_clean)
                            quad_map[pid].add(eid_clean)
                            all_quad_workers.add(eid_clean)
                        if nom_clean:
                            quad_map[base_p].add(nom_clean)
                            quad_map[pid].add(nom_clean)
                            all_quad_workers.add(nom_clean)
            print(f"[OK] Cuadrantes SAP HO indexados para {len(quad_map)} proyectos.")
        except Exception as e:
            print(f"Aviso leyendo cuadrantes HO: {e}")

    # Catálogo de proyectos desde carteras
    proy_catalog = {}
    try:
        for srv in carteras_raw.get("servicios_operativos", []):
            pid = srv.get("proyecto", "")
            if pid:
                m_c = re.search(r'(PROY\\d+|SVO\\d+|PGOC\\d+|PIEC\\d+)', pid)
                base_c = m_c.group(1) if m_c else pid
                gid_c = str(srv.get("gestor_proyecto_id") or srv.get("gestor_id") or "00066957").strip()
                if gid_c not in OFFICIAL_GESTORES: gid_c = "00066957"
                proy_catalog[base_c] = {
                    "servicio": srv.get("nombreServicio") or pid,
                    "cliente": srv.get("cliente") or "",
                    "gestor_id": gid_c
                }
    except Exception as e:
        pass
'''

target_step5 = '    # 5. Incorporar trabajadores de Indra Barcelona asignados a Alejandro Coscolin'
if quad_load_code.strip() not in code and target_step5 in code:
    code = code.replace(target_step5, quad_load_code + "\n" + target_step5)
    print("Added quad_load_code.")

# 2. Reemplazar la incorporación de indra_punches para proteger brigadas
old_indra_block = '''    indra_punches = [
        p for p in raw_punches
        if any(k in str(p.get("CPPNOM", "")).lower() or k in str(p.get("CTNO", "")).lower() or k in str(p.get("CLNO", "")).lower() for k in ["indra", "boronat", "roc boronat", "sant joan despi"])
    ]
    for p in indra_punches:
        cd = normalize_dni(p.get("USERDNI"))
        if not cd or cd in bajas_empresa_set or cd in workers_by_dni:
            continue
        p_nom = (p.get("USERNOM") or "").strip()
        p_pt = p.get("CPPNOM") or p.get("CTNO") or "LIMPIEZA INDRA ROC BORONAT"
        p_cli = p.get("CLNO") or "INDRA SOLUCIONES TECNOLOGICAS DE LA INFORMACION"
        workers_by_dni[cd] = {
            "dni": cd,
            "nombre": p_nom,
            "servicio": f"{p_pt} ({p_cli})",
            "sector": "INDRA",
            "fuente_censo": "indra_barcelona_operaciones",
            "gestor_id": g_cos["id"],
            "gestor_nombre": g_cos["nombre"],
            "gestor_corto": g_cos["nombre_corto"],
            "empresa_badge": g_cos["empresa_badge"],
            "empresa_grupo": g_cos["empresa_grupo"],
            "id_empleado": str(p.get("USERCOD") or p.get("USERID") or ""),
            "telefono": "",
            "email": "",
            "cliente": p_cli,
            "inicio_contrato": "01/01/2024",
            "fin_contrato": "Indefinido",
            "dias_fin_contrato": None,
            "tipo_contrato": "Fijo",
            "estado_sap_hoy": "Hora trabajada",
            "en_baja_sap": False,
            "dias_baja_mes": 0,
            "de_vacaciones_sap": False,
            "dias_vacaciones_octubre": [],
            "horario_habitual": "06:00 - 14:00 (Lunes a Viernes)",
            "proyectos_mes": [],
            "horas_semana": 38.5
        }'''

new_indra_block = '''    indra_punches = [
        p for p in raw_punches
        if any(k in str(p.get("CPPNOM", "")).lower() or k in str(p.get("CTNO", "")).lower() or k in str(p.get("CLNO", "")).lower() for k in ["indra", "boronat", "roc boronat", "sant joan despi"])
    ]
    indra_quad_emps = quad_map.get("PROY015730", set())
    for p in indra_punches:
        cd = normalize_dni(p.get("USERDNI"))
        if not cd or cd in bajas_empresa_set or cd in workers_by_dni:
            continue
        p_nom = (p.get("USERNOM") or "").strip()
        p_eid = str(p.get("USERCOD") or p.get("USERID") or "").strip().lstrip("0")
        p_norm = normalize_name(p_nom)

        # Distinguir personal de Brigada de trabajadores fijos de Indra
        worker_punches = punches_by_dni.get(cd, [])
        pts = [pt.get("punto", "") for pt in worker_punches]
        is_brigada = any("PIEC" in x or "PGOC" in x or "NO FACTURABLE" in x for x in pts)
        in_indra_quad = (p_eid in indra_quad_emps) or (p_norm in indra_quad_emps)

        if is_brigada or (not in_indra_quad and len(pts) <= 3):
            # Asignar a su servicio base de Brigada
            workers_by_dni[cd] = {
                "dni": cd,
                "nombre": p_nom,
                "servicio": "PGOC018081L - PGO LIMPIEZA BARCELONA (BRIGADA)",
                "sector": "BRIGADA / MULTICLIENTE",
                "fuente_censo": "brigada_apoyos_barcelona",
                "gestor_id": "00066957",
                "gestor_nombre": OFFICIAL_GESTORES["00066957"]["nombre"],
                "gestor_corto": OFFICIAL_GESTORES["00066957"]["nombre_corto"],
                "empresa_badge": OFFICIAL_GESTORES["00066957"]["empresa_badge"],
                "empresa_grupo": OFFICIAL_GESTORES["00066957"]["empresa_grupo"],
                "id_empleado": str(p.get("USERCOD") or p.get("USERID") or ""),
                "telefono": "",
                "email": "",
                "cliente": "SIFU, S.L.",
                "inicio_contrato": "01/01/2024",
                "fin_contrato": "Indefinido",
                "dias_fin_contrato": None,
                "tipo_contrato": "Fijo",
                "estado_sap_hoy": "Hora trabajada",
                "en_baja_sap": False,
                "dias_baja_mes": 0,
                "de_vacaciones_sap": False,
                "dias_vacaciones_octubre": [],
                "horario_habitual": "Según cuadrante Brigada",
                "proyectos_mes": [],
                "horas_semana": 38.5,
                "es_brigada": True
            }
        else:
            p_pt = p.get("CPPNOM") or p.get("CTNO") or "LIMPIEZA INDRA ROC BORONAT"
            p_cli = p.get("CLNO") or "INDRA SOLUCIONES TECNOLOGICAS DE LA INFORMACION"
            workers_by_dni[cd] = {
                "dni": cd,
                "nombre": p_nom,
                "servicio": f"{p_pt} ({p_cli})",
                "sector": "INDRA",
                "fuente_censo": "indra_barcelona_operaciones",
                "gestor_id": g_cos["id"],
                "gestor_nombre": g_cos["nombre"],
                "gestor_corto": g_cos["nombre_corto"],
                "empresa_badge": g_cos["empresa_badge"],
                "empresa_grupo": g_cos["empresa_grupo"],
                "id_empleado": str(p.get("USERCOD") or p.get("USERID") or ""),
                "telefono": "",
                "email": "",
                "cliente": p_cli,
                "inicio_contrato": "01/01/2024",
                "fin_contrato": "Indefinido",
                "dias_fin_contrato": None,
                "tipo_contrato": "Fijo",
                "estado_sap_hoy": "Hora trabajada",
                "en_baja_sap": False,
                "dias_baja_mes": 0,
                "de_vacaciones_sap": False,
                "dias_vacaciones_octubre": [],
                "horario_habitual": "06:00 - 14:00 (Lunes a Viernes)",
                "proyectos_mes": [],
                "horas_semana": 38.5,
                "es_brigada": False
            }'''

if old_indra_block in code:
    code = code.replace(old_indra_block, new_indra_block)
    print("Replaced indra_block with smart classification.")

# 3. Detección de Reubicación dentro del bucle de trabajadores
reubicacion_hook = '''        # --- MOTOR AUTÓNOMO: Detección de Reubicación / Cambio de Servicio ---
        eid_clean = str(w_meta.get("id_empleado") or "").strip().lstrip("0")
        cnom_norm = normalize_name(name)
        reubicado = False
        servicio_anterior = None

        if worker_punches:
            w_punches_sorted = sorted(worker_punches, key=lambda x: x["dt"], reverse=True)
            last_punch_pt = w_punches_sorted[0].get("punto", "")
            m_last = re.search(r'(PROY\\d+|SVO\\d+|PGOC\\d+|PIEC\\d+)', last_punch_pt)
            m_curr = re.search(r'(PROY\\d+|SVO\\d+|PGOC\\d+|PIEC\\d+)', w_meta.get("servicio", ""))

            if m_last and m_curr and m_last.group(1) != m_curr.group(1):
                prev_code = m_curr.group(1)
                in_prev_quad = (eid_clean in quad_map.get(prev_code, set())) or (cnom_norm in quad_map.get(prev_code, set()))
                if not in_prev_quad:
                    reubicado = True
                    servicio_anterior = w_meta["servicio"]
                    new_code = m_last.group(1)
                    new_meta = proy_catalog.get(new_code, {})
                    new_serv_name = new_meta.get("servicio") or last_punch_pt
                    new_cli_name = new_meta.get("cliente") or ""
                    w_meta["servicio"] = f"{new_serv_name} ({new_cli_name})" if new_cli_name else new_serv_name
                    if new_meta.get("gestor_id") and new_meta["gestor_id"] in OFFICIAL_GESTORES:
                        new_g = OFFICIAL_GESTORES[new_meta["gestor_id"]]
                        w_meta["gestor_id"] = new_g["id"]
                        w_meta["gestor_nombre"] = new_g["nombre"]
                        w_meta["gestor_corto"] = new_g["nombre_corto"]
                        w_meta["empresa_badge"] = new_g["empresa_badge"]
'''

target_loop = '        # Buscar fichajes del trabajador\n        worker_punches = punches_by_dni.get(cdni, [])'
if reubicacion_hook.strip() not in code and target_loop in code:
    code = code.replace(target_loop, target_loop + "\n" + reubicacion_hook)
    print("Added reubicacion_hook.")

# 4. Evaluación de Estado Hoy con Detección Autónoma de Suplencias e Inactivos
old_no_fichado = '''            else:
                estado_hoy = "NO_FICHADO"
                kpis_no_fichados_hoy += 1
                diagnostico_hoy = "⚠️ Sin marcaje registrado en app para hoy"'''

new_no_fichado = '''            else:
                # Comprobar cuadrante activo en el servicio asignado
                m_serv = re.search(r'(PROY\\d+|SVO\\d+|PGOC\\d+|PIEC\\d+)', w_meta.get("servicio", ""))
                serv_code = m_serv.group(1) if m_serv else ""
                in_current_quad = (serv_code in quad_map) and ((eid_clean in quad_map[serv_code]) or (cnom_norm in quad_map[serv_code]))
                has_any_quad = (eid_clean in all_quad_workers) or (cnom_norm in all_quad_workers)

                if not in_current_quad and serv_code in quad_map:
                    estado_hoy = "SIN_TURNO_ASIGNADO"
                    estado_semaforo = "neutral"
                    diagnostico_hoy = "⚪ Sin turno programado en cuadrante activo del mes (Fin de suplencia / Cobertura finalizada)"
                    diagnostico = f"⚪ Sin asignación en cuadrante activo de {serv_code}"
                elif dias_fichados_cnt == 0 and not has_any_quad:
                    estado_hoy = "INACTIVO_SIN_CUADRANTE"
                    estado_semaforo = "neutral"
                    diagnostico_hoy = "⚠️ Sin actividad operativa ni cuadrante en el mes (Posible baja de empresa / Pendiente auditar)"
                    diagnostico = "⚠️ Sin cuadrante ni marcajes en el mes (Auditar situación laboral)"
                elif w_meta.get("es_brigada"):
                    estado_hoy = "DESCANSO"
                    estado_semaforo = "ok"
                    diagnostico_hoy = "🛠️ Personal de Brigada (Sin actuación programada hoy)"
                    diagnostico = "🛠️ Brigada Operativa SIFU"
                else:
                    estado_hoy = "NO_FICHADO"
                    kpis_no_fichados_hoy += 1
                    diagnostico_hoy = "⚠️ Sin marcaje registrado en app para hoy"'''

if old_no_fichado in code:
    code = code.replace(old_no_fichado, new_no_fichado)
    print("Replaced no_fichado with autonomous classification.")

# 5. Agregar campos reubicado y servicio_anterior al w_payload
old_payload = '''        w_payload = {
            "nombre": name,
            "dni": cdni,'''

new_payload = '''        w_payload = {
            "nombre": name,
            "dni": cdni,
            "reubicado": reubicado,
            "servicio_anterior": servicio_anterior,'''

if old_payload in code and '"reubicado": reubicado' not in code:
    code = code.replace(old_payload, new_payload)
    print("Added reubicado to w_payload.")

with open(bcn_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Patch applied to build_bcn_contraste.py successfully.")
