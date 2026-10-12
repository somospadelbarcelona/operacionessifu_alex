---
name: custom-agents
description: Guía y capacidad para crear, configurar y orquestar Agentes Personalizados (Custom Agents) en Antigravity según el estándar oficial de Google Antigravity.
---

# Antigravity Custom Agents

Esta habilidad enseña a definir y orquestar Agentes Personalizados (*Custom Agents*) en el proyecto, siguiendo el estándar oficial de Google Antigravity ([Introducing Custom Agents](https://antigravity.google/blog/introducing-custom-agents)).

## Ubicación de los Agentes

- **A nivel de proyecto (Workspace):** `.agents/agents/<nombre>.md`
- **A nivel global del usuario:** `~/.gemini/config/agents/<nombre>.md`

Cualquier archivo `.md` ubicado en `.agents/agents/` se descubre automáticamente y se comparte con todo el equipo vía Git.

---

## Anatomía de un Custom Agent

Los agentes se definen con un bloque YAML en el frontmatter y las instrucciones del sistema en el cuerpo Markdown:

```markdown
---
name: nombre-del-agente
description: Descripción clara de su función y cuándo usarlo.
model: flash | pro | inherit
mainAgent: true | false
subagent: true | false
permissionMode: acceptEdits | bypassPermissions
commandExecutionPolicy: auto
tools:
  - view_file
  - replace_file_content
  - run_command
skills:
  - skills/nombre-habilidad
---

# Core Instructions
Aquí se detallan las directrices principales, el rol y los pasos de trabajo del agente.
```

---

## Características Clave en Antigravity

### 1. Simetría de Ejecución (`mainAgent` vs `subagent`)
- `mainAgent: true`: Permite seleccionar el agente en el desplegable de la interfaz gráfica de Antigravity 2.0 o ejecutarlo directamente desde la CLI con:
  ```bash
  agy --agent <nombre-del-agente>
  ```
- `subagent: true`: Permite que un agente principal o coordinador lo delegue automáticamente como subagente para realizar tareas especializadas en paralelo.

### 2. Políticas de Seguridad Acotadas (`commandExecutionPolicy`)
- `commandExecutionPolicy: auto`: Permite ejecutar pruebas y compilaciones estándar de forma autónoma en segundo plano, manteniendo protegidas las acciones destructivas tras confirmación manual.
- `permissionMode: acceptEdits`: Acepta ediciones controladas en el espacio de trabajo.

### 3. Conjunto de Herramientas y Habilidades Acotadas (`tools` y `skills`)
- En lugar de saturar la ventana de contexto con decenas de herramientas y habilidades, un agente personalizado solo recibe la lista explícita definida en `tools` y `skills`.
- Esto reduce drásticamente el consumo de tokens y evita confusiones en la selección de herramientas.
