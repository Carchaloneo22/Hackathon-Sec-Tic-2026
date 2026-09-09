# TRAZO — Mapa Interactivo de Contratación Pública en Colombia

> Grafo estilo Obsidian que visualiza cómo se mueve la plata del Estado colombiano: entidades, proveedores, contratos y sanciones, conectados como nodos que aparecen y se exploran en vivo.

Este archivo es la fuente de verdad del proyecto para Claude Code. Contiene visión, arquitectura, modelo de datos y requisitos funcionales. Léelo completo antes de generar código.

---

## 1. Visión

Colombia publica datos abiertos de contratación (SECOP), registro empresarial (RUES), sanciones fiscales (Contraloría), disciplinarias (Procuraduría) y financieras (Supersociedades) — pero en portales separados, sin relación visible entre sí. **Trazo** unifica esas fuentes en un solo grafo interactivo: buscas una entidad o un proveedor, y el grafo va revelando en tiempo real con quién contrata, qué sanciones tiene, y qué otras entidades tocan esos mismos actores.

La metáfora es el grafo de Obsidian: nodos que aparecen con una animación cuando se descubren, física de atracción/repulsión, y un panel lateral con el detalle al hacer clic. La diferencia es que aquí cada nodo es una entidad real del Estado o del sector privado colombiano, y cada arista es una relación verificable (un contrato, una sanción, un registro).

**Objetivo del hackathon:** una demo ambiciosa pero robusta — prioriza que el flujo principal (buscar → construir grafo → expandir → inspeccionar) funcione perfecto sobre cubrir todas las fuentes de datos posibles.

---

## 2. Fuente de datos: Croma API (Colombia)

Base URL: `https://api.croma.run`
Docs: https://docs.usecroma.com/api-reference/colombia/
Auth: `Authorization: Bearer CROMA_API_KEY` (nunca se expone al frontend — ver sección Backend).

### Endpoints núcleo del grafo (fase 1, MVP)

| Endpoint | Uso en el grafo |
|---|---|
| `rues_entities_by_name` / `rues_entity_by_nit` | Nodo raíz: identifica la empresa/entidad, trae razón social, NIT, representante legal |
| `secop_processes_by_entity` | Desde una entidad estatal → procesos de contratación que publicó |
| `secop_contracts_by_provider` | Desde un proveedor → contratos que ha ganado (y con qué entidades) |
| `secop_sanctions_by_provider` | Sanciones/multas del proveedor → nodo de tipo "sanción" |
| `secop_contract` | Detalle completo de un contrato específico (para el panel lateral) |
| `secop_process` | Detalle completo de un proceso de contratación |

### Endpoints de enriquecimiento (fase 2, si el tiempo alcanza)

| Endpoint | Uso |
|---|---|
| `contraloria_fiscal_records` | ¿Alguna persona/empresa del grafo tiene responsabilidad fiscal? → nodo de alerta |
| `procuraduria_disciplinary_records` | Antecedentes disciplinarios → nodo de alerta |
| `supersociedades_financial_statements` | Salud financiera de la empresa → panel de detalle enriquecido |
| `sicaac_insolvency_cases` | Procesos de insolvencia → nodo de alerta |
| `secop_processes_by_entity` (recursivo) | Permite saltar de una entidad a otra que comparte proveedores → esto es lo que hace el grafo "explorable" en vez de un árbol plano |

No uses endpoints de otros países (Perú, México) ni de personas naturales fuera del contexto de contratación (p. ej. `policia_criminal_records`, `registraduria_vital_status`) salvo que decidamos explícitamente ampliar el alcance — el foco es contratación pública, no antecedentes personales.

---

## 3. Arquitectura

### Stack
- **Frontend:** React + Vite + TypeScript
- **Grafo:** `react-force-graph-2d` (sobre `d3-force`) — permite física de nodos, canvas performante, y hooks de render por nodo para las animaciones custom
- **Estado del grafo:** Zustand (simple, sin boilerplate de Redux)
- **Estilos:** Tailwind CSS, tema oscuro por defecto
- **Backend:** Node.js + Express + TypeScript — actúa como proxy autenticado hacia Croma, nunca se llama a Croma directamente desde el navegador
- **Cache:** capa in-memory (`lru-cache` o similar) en el backend para no repetir llamadas idénticas dentro de la sesión de hackathon (los rate limits de Croma son compartidos por todo el equipo)

### Estructura de carpetas propuesta

```
trazo/
├── CLAUDE.md
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── search.ts          # busca entidad/proveedor por nombre
│   │   │   ├── expand.ts          # dado un nodo, trae sus conexiones
│   │   │   └── detail.ts          # detalle completo de un nodo para el panel
│   │   ├── services/
│   │   │   └── croma.ts           # cliente HTTP hacia api.croma.run + cache
│   │   ├── graph/
│   │   │   └── transform.ts       # convierte respuestas de Croma → nodos/aristas
│   │   └── server.ts
│   └── .env                       # CROMA_API_KEY=...
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── GraphCanvas.tsx    # el grafo force-directed
    │   │   ├── NodeDetailPanel.tsx
    │   │   ├── SearchBar.tsx
    │   │   └── StoryMode.tsx      # modo demo guiado (ver sección 6)
    │   ├── store/
    │   │   └── graphStore.ts      # Zustand: nodos, aristas, nodo seleccionado
    │   ├── api/
    │   │   └── client.ts          # llama al backend propio, nunca a Croma
    │   └── App.tsx
    └── ...
```

---

## 4. Modelo de datos del grafo

### Tipos de nodo

| Tipo | Color sugerido | Fuente | Ejemplo |
|---|---|---|---|
| `entidad_estatal` | Azul | RUES / SECOP | Alcaldía de Medellín |
| `proveedor` | Verde | RUES | Empresa contratista S.A.S. |
| `contrato` | Amarillo, más pequeño | SECOP | Contrato #CO1.PCCNTR.123456 |
| `sancion` | Rojo, con glow/pulso | SECOP sanciones | Multa por incumplimiento |
| `alerta_fiscal` | Naranja | Contraloría | Responsabilidad fiscal declarada |
| `alerta_disciplinaria` | Naranja oscuro | Procuraduría | Sanción disciplinaria |

Cada nodo lleva: `id`, `type`, `label`, `raw` (payload original de Croma para el panel de detalle), `discovered_at` (para la animación de aparición), `expanded` (boolean).

### Tipos de arista

- `contrató_a` (entidad → proveedor, vía contrato)
- `ejecuta` (proveedor → contrato)
- `sancionado_en` (proveedor → sanción)
- `comparte_proveedor_con` (entidad ↔ entidad, inferida cuando dos entidades contratan al mismo proveedor — **esta es la relación más valiosa de la demo**, muestra redes de contratistas recurrentes)
- `tiene_alerta` (proveedor/persona → alerta_fiscal / alerta_disciplinaria)

---

## 5. Requisitos funcionales clave

### 5.1 Construcción animada del grafo (prioridad alta)
- El usuario busca una entidad o proveedor por nombre.
- El nodo raíz aparece primero, solo, con una animación de entrada (fade + scale desde 0).
- A medida que llegan los datos (contratos, proveedores, sanciones), **cada nodo nuevo aparece con un pequeño delay escalonado** (~150–300ms entre uno y otro), no todos de golpe — aunque el backend responda todo junto, el frontend debe *revelar* los nodos secuencialmente para que se sienta como una investigación en progreso, no una carga de página.
- Las aristas se dibujan después de que ambos nodos que conecta ya existen, con una animación de "trazo" (stroke-dasharray si es SVG, o interpolación de opacidad si es canvas).
- Mientras se construye, mostrar un indicador sutil tipo "descubriendo conexiones..." con el conteo de nodos encontrados.

### 5.2 Panel de detalle al hacer clic (prioridad alta)
- Click en cualquier nodo → panel lateral (deslizable desde la derecha) con:
  - Nombre completo, tipo de nodo, y un resumen en lenguaje natural de qué representa ("Esta empresa ha ganado 14 contratos con 6 entidades distintas desde 2021")
  - Datos crudos relevantes en formato legible (fechas, montos, NIT, número de contrato)
  - Botón "Expandir" si el nodo aún no ha sido explorado (dispara `/expand` en el backend y agrega sus conexiones al grafo con la misma animación de 5.1)
  - Enlace a la fuente oficial si Croma lo provee
- Click fuera del panel o tecla `Esc` lo cierra sin perder el estado del grafo.

### 5.3 Expansión progresiva (prioridad alta — esto es lo que lo hace "ambicioso")
- El grafo NO carga todo de una vez. Empieza con el nodo raíz y su primer nivel de conexiones.
- Cada nodo de tipo `proveedor` o `entidad_estatal` es expandible: al hacer clic en "Expandir" trae su siguiente capa.
- Cuando dos ramas distintas del grafo llegan al mismo proveedor (dos entidades que contrataron al mismo contratista), el grafo debe **fusionar el nodo** en vez de duplicarlo, y resaltar visualmente esa intersección (esto es el momento "wow" de la demo — visibiliza redes de contratistas recurrentes).
- Límite razonable de profundidad/nodos por expansión (p. ej. máx. 15 nodos nuevos por click) para no saturar el layout ni el rate limit de Croma.

### 5.4 Modo historia / demo guiada (prioridad media — red de seguridad para el pitch)
- Dado que las demos en vivo contra una API externa son riesgosas (rate limits, latencia, datos inesperados), construir un **"Modo Historia"**: 2–3 casos reales precargados (capturados con antelación) que reproducen la animación completa del grafo paso a paso, con texto explicativo tipo storytelling ("Esta entidad contrató a esta empresa 8 veces seguidas...").
- El modo en vivo (búsqueda libre) sigue siendo el corazón del proyecto; el modo historia es el respaldo para el momento del jurado.

### 5.5 Filtros y controles (prioridad media)
- Filtrar nodos visibles por tipo (checkbox por color/categoría).
- Filtrar contratos por rango de fecha o monto.
- Buscador interno para centrar el grafo en un nodo ya cargado.

---

## 6. Diseño visual (estilo Obsidian)

- Fondo oscuro (`#0d0d0f` o similar), nodos con glow sutil usando su color de categoría.
- Tipografía monoespaciada o sans condensada para labels de nodo, texto pequeño que solo se agranda al hover/zoom.
- Física del grafo: repulsión moderada, aristas con longitud variable según "fuerza" de relación (un contrato de mayor monto = arista más corta/fuerte).
- Zoom y pan libres; doble clic en un nodo lo centra y hace zoom.
- El panel de detalle no debe tapar el grafo — usar overlay semitransparente o layout de 70/30.
- Revisar la skill de `frontend-design` del repo de Claude antes de construir los componentes visuales, para mantener consistencia y evitar defaults genéricos.

---

## 7. Backend: proxy hacia Croma

- Todas las llamadas a `api.croma.run` pasan por el backend. La API key vive solo en `backend/.env`, nunca en el bundle de frontend.
- Cachear respuestas por `(endpoint, params)` durante la sesión del hackathon — mismo NIT/nombre buscado dos veces no debe volver a golpear a Croma.
- Manejar `429` (rate limit) con backoff y mostrar en el frontend un estado claro ("Croma está ocupado, reintentando...") en vez de fallar silenciosamente.
- Endpoint `/api/detail/:nodeId` debe poder resolver el detalle completo sin volver a pedir todo el grafo.

### Variables de entorno
```
# backend/.env
CROMA_API_KEY=your_key_here
PORT=4000
CACHE_TTL_SECONDS=3600

# Login (ver sección 10) — usuario/contraseña fijos que protegen toda la API
TRAZO_USERNAME=your_username_here
TRAZO_PASSWORD=your_password_here
```

---

## 8. Roadmap sugerido del hackathon

**Fase 1 — Esqueleto (primeras horas)**
- Backend con `/search`, `/expand`, `/detail` mockeados con datos fijos.
- Frontend con `react-force-graph-2d` mostrando un grafo estático de prueba.
- Conectar backend real a Croma para `rues_entities_by_name` + `secop_processes_by_entity`.

**Fase 2 — El corazón de la demo**
- Animación de aparición escalonada de nodos.
- Panel de detalle funcional con datos reales.
- Expansión progresiva con fusión de nodos compartidos.

**Fase 3 — Pulido y red de seguridad**
- Modo Historia con 2–3 casos precargados.
- Filtros básicos.
- Manejo de errores/rate limits visible y elegante.

**Fase 4 (si sobra tiempo)**
- Alertas fiscales/disciplinarias como nodos de riesgo.
- Compartir un grafo vía URL (estado serializado).

**Fase 5 — Investigación colaborativa asíncrona (⚠️ NO iniciar sin confirmación explícita)**
No empezar esta fase automáticamente aunque sobre tiempo tras la Fase 4. Solo se desarrolla si el equipo la confirma explícitamente en el momento — es un "nice to have" narrativo, no parte del compromiso del MVP.

Si se confirma, alcance sugerido:
- El grafo deja de vivir solo en el estado del cliente: se persiste en el backend bajo un `case_id` (una "sala de investigación" por caso/entidad raíz investigada).
- El link del caso es compartible: cualquiera que lo abra ve el estado acumulado del grafo, no arranca desde cero.
- Cada nodo descubierto/expandido guarda quién lo trajo y cuándo (`discovered_by`, `discovered_at`) — se muestra como atribución sutil en el panel de detalle, no como feature intrusiva.
- Sincronización simple: polling liviano (cada 5–10s) o refetch al reabrir el caso — **no WebSockets ni tiempo real**, para no meter complejidad de resolución de conflictos en el tiempo que queda de hackathon.
- Extra opcional dentro de esta misma fase: notas por nodo, al estilo backlinks de Obsidian pero para observaciones humanas del equipo (p. ej. "esto huele raro, revisar el contrato #123").
- Encaja con el eje de "acceso a la información": el grafo se convierte en herramienta de trabajo colectivo tipo redacción de datos/organización anticorrupción, no solo un visor individual.

**Extra opcional dentro de Fase 5 — Canvas de investigación (⚠️ solo si Fase 5 ya está confirmada y sigue sobrando tiempo)**
Un modo aparte del grafo automático, al estilo Obsidian Canvas: un lienzo libre donde el equipo puede *sacar* nodos del grafo generado y organizarlos manualmente — agruparlos, anotarlos, conectar hallazgos que la física del grafo no capturaría (p. ej. "estos 3 contratos, aunque no comparten proveedor directo, coinciden en fecha y monto"). Es la capa de *curación y reporte* sobre la capa de *exploración automática*:
- El grafo force-directed sigue siendo la vista de descubrimiento (qué existe y cómo se conecta según los datos de Croma).
- El canvas es la vista de síntesis (qué decidió el equipo que es relevante, y por qué) — pensado como insumo directo para armar el reporte final o la nota periodística.
- Técnicamente: lienzo de posiciones libres (no física de d3-force), tarjetas arrastrables que referencian un `nodeId` del grafo original más texto libre del equipo, persistido igual que el resto de Fase 5.
- No confundir con el board del grafo mismo — si Fase 5 no se confirma, este extra tampoco aplica.

---

## 9. Consideraciones éticas

- Todos los datos son públicos y provienen de fuentes oficiales del Estado colombiano vía Croma — no se hace scraping por fuera de la API.
- El proyecto expone patrones de contratación pública (transparencia), no hace juicios de valor automáticos: una sanción o un patrón de contratos repetidos se muestra como dato, no como acusación. El lenguaje del panel de detalle debe ser neutral y descriptivo.
- No mezclar en el MVP datos de personas naturales fuera del rol de representante legal/contratista — el foco es institucional, no vigilancia de individuos.

---

## 10. Autenticación

No hay registro de usuarios ni base de datos de credenciales — es un gate simple de
usuario/contraseña fijos (`TRAZO_USERNAME`/`TRAZO_PASSWORD` en `backend/.env`), pensado
para una demo de hackathon detrás de una URL pública, no como sistema de auth real.

- El frontend muestra `LoginScreen` mientras no haya credencial guardada (`authStore`,
  persistida en `localStorage` bajo la clave `trazo-auth`).
- Al loguearse, el frontend codifica `usuario:contraseña` en base64 y lo reenvía como
  header `Authorization: Basic ...` en cada request a la API (`api/client.ts`).
- El backend valida ese header en `services/auth.ts` (comparación timing-safe) para
  todas las rutas bajo `/api/*` excepto `/api/health` y `/api/auth/login` — así la API
  key de Croma y el rate limit compartido quedan protegidos de uso no autorizado.
- Un 401 en cualquier request limpia la credencial guardada y vuelve a mostrar el login.

No confundir con `identityStore` (`author`, Fase 5): esa es solo una etiqueta de
atribución dentro de una sala de investigación, no autenticación.

## 11. Despliegue

Trazo se despliega junto al resto de Personal Suite vía Docker Compose, en el
subdominio `trazo.jesusflorez.cloud`. Ver `deploy/docker-compose.yml` (servicios
`trazo-backend` y `trazo-frontend`) y `deploy/nginx/conf.d/default.conf`.

- El build context de ambos Dockerfiles es `Trazo/` (no `Trazo/backend/` ni
  `Trazo/frontend/`), porque tanto el backend como el frontend importan `../shared/`
  directamente desde TypeScript fuente — necesitan verlo en el contexto de build.
- `trazo-backend` expone `/api/health` sin auth para el healthcheck de Docker; el resto
  de `/api/*` exige la credencial (ver sección 10).
- Las "salas de investigación" (Fase 5, `backend/data/cases/`) se persisten en el
  volumen Docker `trazo_cases` — sin eso se perderían en cada rebuild del contenedor.
- El certificado SSL de `jesusflorez.cloud` es uno solo con varios SAN (no wildcard);
  agregar un subdominio nuevo requiere volver a correr `deploy/init-ssl.sh` para que el
  subdominio quede incluido en el certificado.

## 12. Convenciones de código

- TypeScript estricto en ambos proyectos (`strict: true`).
- Componentes de React funcionales, hooks, sin clases.
- Nombrar los tipos de nodo/arista exactamente como en la sección 4 (usarlos como enums compartidos entre backend y frontend, idealmente en un paquete `shared/` o `types.ts` importado por ambos).
- Commits pequeños y descriptivos — dado el contexto de hackathon, priorizar que cada commit deje el proyecto en estado funcional (útil si hay que hacer rollback rápido antes del pitch).