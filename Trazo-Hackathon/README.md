# Trazo

## Acceso:
user: trazo
pass: dwhg26h7E4Tz

**Mapa interactivo de contratación pública en Colombia.** Un grafo estilo Obsidian que revela en vivo cómo se mueve la plata del Estado: entidades, proveedores, contratos y sanciones, conectados como nodos que aparecen y se exploran a medida que investigas.

Colombia publica datos abiertos de contratación (SECOP), registro empresarial (RUES), sanciones fiscales (Contraloría) y disciplinarias (Procuraduría) — pero en portales separados, sin relación visible entre sí. Trazo los unifica: buscas una entidad o un proveedor, y el grafo va revelando con quién contrata, qué sanciones tiene, y qué otras entidades tocan esos mismos actores.

Construido en la Hackathon "IA-Hackathon GOV-TECH de Croma" usando [Croma API](https://docs.usecroma.com/api-reference/colombia/) como fuente de datos.

## Características

- **Construcción animada del grafo** — los nodos aparecen escalonados a medida que llegan los datos, no todos de golpe; se siente como una investigación en progreso.
- **Expansión progresiva** — el grafo empieza con un nodo raíz y crece por capas al hacer clic en "Expandir", con un límite razonable de nodos por expansión.
- **Fusión de nodos compartidos** — cuando dos entidades contratan al mismo proveedor, el grafo funde el nodo en vez de duplicarlo y resalta la intersección: así se visibilizan redes de contratistas recurrentes.
- **Panel de detalle** — clic en cualquier nodo abre un panel lateral con resumen en lenguaje natural, datos crudos (fechas, montos, NIT) y enlace a la fuente oficial.
- **Alertas fiscales y disciplinarias** — nodos de riesgo (`alerta_fiscal`, `alerta_disciplinaria`) enriquecen el grafo con antecedentes de Contraloría y Procuraduría.
- **Filtros** — por tipo de nodo, rango de fechas y monto de contrato.
- **Compartir grafo vía URL** — el estado del grafo se puede compartir con un link.
- **Salas de investigación colaborativa** — cada caso se persiste bajo un `case_id` compartible; el equipo ve el estado acumulado del grafo, con atribución de quién descubrió cada nodo y notas por nodo estilo backlinks de Obsidian.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript, `react-force-graph-2d`, Zustand, Tailwind CSS |
| Backend | Node.js + Express + TypeScript — proxy autenticado hacia Croma |
| Datos | [Croma API](https://docs.usecroma.com/api-reference/colombia/) (RUES, SECOP, Contraloría, Procuraduría) |
| Compartido | `shared/` — tipos de nodo/arista comunes entre frontend y backend |

Ver [CLAUDE.md](./CLAUDE.md) para la arquitectura completa, el modelo de datos del grafo y el roadmap del hackathon.

## Arquitectura

```
trazo/
├── backend/     # Proxy autenticado hacia Croma, cache, transformación a nodos/aristas
├── frontend/    # Grafo interactivo, panel de detalle, modo historia
└── shared/      # Tipos de nodo/arista compartidos
```

Todas las llamadas a Croma pasan por el backend — la API key nunca se expone al navegador. Las respuestas se cachean en memoria por `(endpoint, params)` para no repetir llamadas idénticas dentro de una sesión.

## Cómo correrlo localmente

### Requisitos
- Node.js 20+
- Una API key de [Croma](https://docs.usecroma.com/) (opcional — sin ella el backend sirve datos de prueba automáticamente vía `MOCK_MODE`)

### Backend

```bash
cd backend
cp .env.example .env   # completa CROMA_API_KEY, TRAZO_USERNAME, TRAZO_PASSWORD
npm install
npm run dev             # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

El frontend queda protegido por un login simple (usuario/contraseña fijos, definidos en `backend/.env`) — ver sección 10 de [CLAUDE.md](./CLAUDE.md).

## Consideraciones éticas

Todos los datos son públicos y provienen de fuentes oficiales del Estado colombiano vía Croma. Trazo expone patrones de contratación pública (transparencia) sin hacer juicios de valor automáticos: una sanción o un patrón de contratos repetidos se muestra como dato, no como acusación. El foco es institucional — no se hace vigilancia de personas naturales fuera de su rol de representante legal o contratista.

## Equipo

- Jesús Flórez (dvchinx)
