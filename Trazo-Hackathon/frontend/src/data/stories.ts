// Casos precargados para el Modo Historia (CLAUDE.md sección 5.4): red de seguridad
// para el pitch cuando la demo en vivo contra Croma no es viable (rate limit, latencia,
// sin conexión). Los datos reproducen el mismo caso mock verificado que usa el backend
// en `backend/src/data/mock-fixtures.ts` (BIDFOR S.A.S., NIT 901398448, y las entidades
// que lo contratan), así que la narrativa es consistente si el jurado luego prueba el
// modo en vivo con el backend en modo mock.
//
// Cada paso llama a `ingest()` con exactamente los mismos nodos/aristas que produciría
// una expansión real — el revelado escalonado y la fusión de nodos son el mecanismo real
// del grafo, no una animación aparte. `storyMode` en el store desactiva las llamadas al
// backend para el panel de detalle: cada nodo trae su propio resumen embebido en `raw`.

import type { GraphEdge, GraphNode } from "@shared/types";

export interface StoryStep {
  narration: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mergedNodeIds?: string[];
}

export interface Story {
  id: string;
  title: string;
  teaser: string;
  steps: StoryStep[];
}

function node(
  id: string,
  type: GraphNode["type"],
  label: string,
  summary: string,
  raw: Record<string, unknown> = {}
): GraphNode {
  return { id, type, label, raw: { summary, ...raw }, discovered_at: 0, expanded: false };
}

function edge(source: string, target: string, type: GraphEdge["type"], raw?: unknown): GraphEdge {
  return { id: `${source}->${target}:${type}`, source, target, type, raw };
}

const BIDFOR = "901398448";
const MEDELLIN = "890905211";
const BOGOTA = "899999061";
const ANTIOQUIA = "890980040";
const HORIZONTE = "900111222";
const TECNO_INSUMOS = "900333444";

const C_BIDFOR_MEDELLIN = "CO1.PCCNTR.9492640";
const C_BIDFOR_BOGOTA = "CO1.PCCNTR.9492700";
const C_BIDFOR_ANTIOQUIA = "CO1.PCCNTR.9492750";
const C_HORIZONTE_MEDELLIN = "CO1.PCCNTR.8801234";
const C_HORIZONTE_BOGOTA = "CO1.PCCNTR.8801290";
const C_TECNO_ANTIOQUIA = "CO1.PCCNTR.7705500";
const SANCION_TECNO = `sancion:${TECNO_INSUMOS}:SEC-2023-0456`;

export const STORIES: Story[] = [
  {
    id: "bidfor-red-de-contratistas",
    title: "BIDFOR: un proveedor, tres entidades",
    teaser:
      "Un mismo contratista conecta a Medellín, Bogotá y Antioquia — y una segunda rama termina en una sanción.",
    steps: [
      {
        narration:
          "Empezamos con BIDFOR S.A.S., un proveedor activo en el registro mercantil (RUES). Vamos a rastrear con qué entidades del Estado ha contratado.",
        nodes: [
          node(
            BIDFOR,
            "proveedor",
            "BIDFOR S.A.S.",
            "BIDFOR S.A.S. está activa en el registro mercantil (Medellín para Antioquia). Vamos a expandirla para ver sus contratos públicos.",
            { nit: BIDFOR, chamber_name: "MEDELLIN PARA ANTIOQUIA" }
          ),
        ],
        edges: [],
      },
      {
        narration:
          "Al expandir BIDFOR aparecen tres entidades que le compraron: Medellín, Bogotá y la Gobernación de Antioquia, por casi $590 millones en total. El grafo conecta automáticamente a las tres entidades entre sí — comparten el mismo contratista, sin que nadie lo haya buscado a propósito.",
        nodes: [
          node(
            MEDELLIN,
            "entidad_estatal",
            "DISTRITO ESPECIAL DE CIENCIA TECNOLOGIA E INNOVACION DE MEDELLIN",
            "El Distrito de Medellín le compró a BIDFOR elementos de emergencia por $174.167.311 (contrato en ejecución)."
          ),
          node(
            BOGOTA,
            "entidad_estatal",
            "BOGOTÁ D.C. (DISTRITO CAPITAL)",
            "Bogotá le compró a BIDFOR equipos de cómputo para dependencias distritales por $320.000.000 (contrato en ejecución)."
          ),
          node(
            ANTIOQUIA,
            "entidad_estatal",
            "GOBERNACIÓN DE ANTIOQUIA",
            "La Gobernación de Antioquia le compró a BIDFOR mobiliario para oficinas regionales por $95.000.000 (contrato terminado)."
          ),
          node(
            C_BIDFOR_MEDELLIN,
            "contrato",
            "Suministrar elementos de emergencia",
            "Contrato entre Medellín y BIDFOR S.A.S. por $174.167.311, estado: En ejecución.",
            { value: 174167311, sign_date: "2026-05-19", status: "En ejecución" }
          ),
          node(
            C_BIDFOR_BOGOTA,
            "contrato",
            "Suministro de equipos de cómputo para dependencias distritales",
            "Contrato entre Bogotá y BIDFOR S.A.S. por $320.000.000, estado: En ejecución.",
            { value: 320000000, sign_date: "2026-03-10", status: "En ejecución" }
          ),
          node(
            C_BIDFOR_ANTIOQUIA,
            "contrato",
            "Dotación de mobiliario para oficinas regionales",
            "Contrato entre la Gobernación de Antioquia y BIDFOR S.A.S. por $95.000.000, estado: Terminado.",
            { value: 95000000, sign_date: "2025-02-01", status: "Terminado" }
          ),
        ],
        edges: [
          edge(MEDELLIN, BIDFOR, "contrató_a", { contract_id: C_BIDFOR_MEDELLIN, value: 174167311 }),
          edge(BIDFOR, C_BIDFOR_MEDELLIN, "ejecuta"),
          edge(BOGOTA, BIDFOR, "contrató_a", { contract_id: C_BIDFOR_BOGOTA, value: 320000000 }),
          edge(BIDFOR, C_BIDFOR_BOGOTA, "ejecuta"),
          edge(ANTIOQUIA, BIDFOR, "contrató_a", { contract_id: C_BIDFOR_ANTIOQUIA, value: 95000000 }),
          edge(BIDFOR, C_BIDFOR_ANTIOQUIA, "ejecuta"),
          edge(MEDELLIN, BOGOTA, "comparte_proveedor_con", { via_provider: BIDFOR }),
          edge(MEDELLIN, ANTIOQUIA, "comparte_proveedor_con", { via_provider: BIDFOR }),
          edge(BOGOTA, ANTIOQUIA, "comparte_proveedor_con", { via_provider: BIDFOR }),
        ],
      },
      {
        narration:
          "Abrimos Medellín para seguir esa rama. Aparece otro proveedor, Constructora Horizonte, con un contrato de mantenimiento vial por más de $1.450 millones — mucho más grande que lo que vimos con BIDFOR.",
        nodes: [
          node(
            HORIZONTE,
            "proveedor",
            "CONSTRUCTORA HORIZONTE S.A.S.",
            "Constructora Horizonte S.A.S. está activa en el registro mercantil (Medellín para Antioquia)."
          ),
          node(
            C_HORIZONTE_MEDELLIN,
            "contrato",
            "Mantenimiento vial zona nororiental",
            "Contrato entre Medellín y Constructora Horizonte S.A.S. por $1.450.000.000, estado: En ejecución.",
            { value: 1450000000, sign_date: "2026-01-20", status: "En ejecución" }
          ),
        ],
        edges: [
          edge(MEDELLIN, HORIZONTE, "contrató_a", { contract_id: C_HORIZONTE_MEDELLIN, value: 1450000000 }),
          edge(HORIZONTE, C_HORIZONTE_MEDELLIN, "ejecuta"),
        ],
      },
      {
        narration:
          "Ahora abrimos Bogotá, que ya estaba en el grafo desde el primer paso. También contrató a Constructora Horizonte — el nodo del proveedor se funde en uno solo y el grafo resalta la intersección: dos ramas distintas de la investigación llegaron al mismo contratista.",
        nodes: [
          node(
            HORIZONTE,
            "proveedor",
            "CONSTRUCTORA HORIZONTE S.A.S.",
            "Constructora Horizonte S.A.S. está activa en el registro mercantil (Medellín para Antioquia)."
          ),
          node(
            C_HORIZONTE_BOGOTA,
            "contrato",
            "Adecuación de parques distritales",
            "Contrato entre Bogotá y Constructora Horizonte S.A.S. por $980.000.000, estado: En ejecución.",
            { value: 980000000, sign_date: "2025-11-05", status: "En ejecución" }
          ),
        ],
        edges: [
          edge(BOGOTA, HORIZONTE, "contrató_a", { contract_id: C_HORIZONTE_BOGOTA, value: 980000000 }),
          edge(HORIZONTE, C_HORIZONTE_BOGOTA, "ejecuta"),
          edge(MEDELLIN, BOGOTA, "comparte_proveedor_con", { via_provider: HORIZONTE }),
        ],
        mergedNodeIds: [HORIZONTE],
      },
      {
        narration:
          "Por último, volvemos a la Gobernación de Antioquia. Contrató a un tercer proveedor, Tecno Insumos de Colombia — y ese proveedor tiene algo más: una sanción de $15.000.000 impuesta por la Cámara de Comercio de Medellín. El grafo la muestra como un nodo rojo, con un pulso que no deja de llamar la atención.",
        nodes: [
          node(
            TECNO_INSUMOS,
            "proveedor",
            "TECNO INSUMOS DE COLOMBIA SAS",
            "Tecno Insumos de Colombia SAS está activa en el registro mercantil (Bogotá). Tiene 1 sanción registrada como contratista del Estado."
          ),
          node(
            C_TECNO_ANTIOQUIA,
            "contrato",
            "Suministro de insumos tecnológicos",
            "Contrato entre la Gobernación de Antioquia y Tecno Insumos de Colombia SAS por $210.000.000, estado: Terminado.",
            { value: 210000000, sign_date: "2025-06-01", status: "Terminado" }
          ),
          node(
            SANCION_TECNO,
            "sancion",
            "Sanción SEC-2023-0456",
            "Sanción impuesta a Tecno Insumos de Colombia SAS por la Cámara de Comercio de Medellín para Antioquia, resolución SEC-2023-0456, por $15.000.000 (publicada 2023-11-02).",
            {
              sanctioning_entity: "Cámara de Comercio de Medellín para Antioquia",
              resolution_number: "SEC-2023-0456",
              value: 15000000,
              published_date: "2023-11-02",
              final_date: "2024-01-15",
            }
          ),
        ],
        edges: [
          edge(ANTIOQUIA, TECNO_INSUMOS, "contrató_a", { contract_id: C_TECNO_ANTIOQUIA, value: 210000000 }),
          edge(TECNO_INSUMOS, C_TECNO_ANTIOQUIA, "ejecuta"),
          edge(TECNO_INSUMOS, SANCION_TECNO, "sancionado_en"),
        ],
      },
      {
        narration:
          "Así es como Trazo convierte datos dispersos de SECOP y RUES en una red navegable: tres entidades, tres proveedores y una sanción, todo conectado en menos de un minuto — sin que el usuario haya hecho una sola búsqueda manual después de la primera.",
        nodes: [],
        edges: [],
      },
    ],
  },
];
