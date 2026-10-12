---
name: package-upgrade-rules
description: Reglas y directrices para auditar, actualizar dependencias y validar la integridad del proyecto.
---

# Directrices para Actualización de Paquetes (Package Upgrade Rules)

Esta habilidad proporciona el protocolo seguro para la comprobación y actualización de dependencias en proyectos.

## Procedimiento Paso a Paso

1. **Inspección Previa:**
   - Leer `package.json` y `package-lock.json` (o manifests equivalentes).
   - Identificar dependencias desactualizadas o con alertas de vulnerabilidad (`npm audit`).

2. **Estrategia de Actualización:**
   - Actualizar primero parches (`patch`) y versiones menores (`minor`) compatibles.
   - En actualizaciones mayores (`major`), revisar los *changelogs* o *breaking changes* antes de proceder.

3. **Verificación y Pruebas:**
   - Ejecutar la suite de tests existente o comandos de verificación/build.
   - Si no existen tests automatizados, comprobar la carga básica de los módulos y scripts afectados.
   - Verificar que no se hayan introducido errores de sintaxis ni conflictos de dependencias.

4. **Registro de Cambios:**
   - Detallar cada paquete actualizado: versión previa -> versión nueva.
   - Confirmar si se requirieron ajustes de código.
