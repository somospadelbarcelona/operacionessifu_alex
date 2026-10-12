# 🏢 SIFU GIRONA - PANEL DE CONTROL OPERATIVO

Sistema de gestión operativa en tiempo real con sincronización bidireccional automática del Excel Maestro.

---

## 🚀 Acceso Rápido desde el Escritorio
En el escritorio tienes 3 accesos directos configurados:
1. **`SIFU GIRONA - Abrir Aplicacion`** ➔ Abre el panel en el navegador (`index.html`).
2. **`MASTER GENERAL GIRONA OKK`** ➔ Abre la hoja de cálculo de Excel para editar datos.
3. **`SIFU GIRONA - Sincronizador Automatico`** ➔ Lanza el proceso en segundo plano que detecta cada `Ctrl + S` en el Excel y actualiza la web al instante.

---

## 📁 Estructura Principal del Proyecto

| Archivo / Carpeta | Función |
| :--- | :--- |
| **`index.html`** | Interfaz visual principal del panel. |
| **`MASTER GENERAL GIRONA OKK.xlsx`** | Base de datos maestra en Excel. |
| **`watch_excel.py`** | Centinela en tiempo real: detecta cambios en el Excel con bloqueo compartido resiliente. |
| **`extract_excel.py`** | Motor de extracción rápida de servicios, pedidos y descubiertos a `master_data.js`. |
| **`Lanzar_Sincro_Master.bat`** | Script de inicio automático de sincronización. |
| **`master_sync_engine.js`** | Motor en el navegador que refresca la pantalla sin recargar cuando hay cambios. |
| **`app.js` & `styles.css`** | Lógica de negocio y estilos de la aplicación. |
| **`orders_module.js` & `vacation_module.js`** | Módulos funcionales activos (Pedidos, Vacaciones). |
| **`src/` & `dist/`** | Código fuente modular y bundle empaquetado Vite / Bun. |
| **`docs_historico/`** | Archivo de documentación de las fases de desarrollo previas. |

---

## ⚡ Comandos Útiles (Terminal)
- **Extraer datos manualmente:**
  ```powershell
  python extract_excel.py
  ```
- **Iniciar monitor en tiempo real:**
  ```powershell
  python watch_excel.py
  ```
- **Recompilar frontend:**
  ```powershell
  bun run build
  ```
