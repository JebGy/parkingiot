import type { NextApiRequest, NextApiResponse } from "next";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Parking IoT API",
    version: "1.0.0",
    description: "Endpoints para actualización de espacios de parking y consulta de estado.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/spaces/update": {
      post: {
        summary: "Actualizar estado de espacio (ESP32)",
        security: [{ basicAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id_espacio: { type: "integer", minimum: 1, maximum: 3 },
                  estado: { type: "boolean" },
                  timestamp: { type: "string", format: "date-time" },
                },
                required: ["id_espacio", "estado", "timestamp"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Actualización correcta",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    space: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        occupied: { type: "boolean" },
                        updated_at: { type: "string", format: "date-time" },
                      },
                    },
                    code: { type: "string", nullable: true, description: "Código asociado cuando el espacio está ocupado" },
                  },
                },
              },
            },
          },
          400: { description: "Solicitud inválida" },
          401: { description: "No autorizado" },
          405: { description: "Método no permitido" },
          500: { description: "Error interno" },
        },
      },
    },
    "/api/spaces": {
      get: {
        summary: "Obtener estado de espacios y estadísticas",
        responses: {
          200: {
            description: "Estados actuales y estadísticas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    spaces: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer" },
                          occupied: { type: "boolean" },
                          updated_at: { type: "string", nullable: true, format: "date-time" },
                        },
                      },
                    },
                    stats: {
                      type: "object",
                      additionalProperties: {
                        type: "object",
                        properties: {
                          occupied_count: { type: "integer" },
                          free_count: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          405: { description: "Método no permitido" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      basicAuth: { type: "http", scheme: "basic" },
    },
  },
} as const;

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(spec);
}