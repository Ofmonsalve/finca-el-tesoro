# Finca El Tesoro

Sistema de gestión de la finca cafetera **El Tesoro** (Santander, 0,87 ha, seis lotes). Cosecha, beneficio, pagos, costos y finanzas en un solo libro.

## Abrir

El libro vive **en el navegador** del dispositivo que use (teléfono o computador). Cada registro de cosecha se guarda solo. No viaja a GitHub.

- **JSON** (barra lateral): descarga el libro completo. Hágalo al terminar el día.
- **Restaurar**: carga un JSON previo. Así el mismo libro pasa de un teléfono a otro.

GitHub guarda el **programa**, no los kilogramos ni los pagos.

## Qué queda en el libro

| Módulo | Qué registra |
|---|---|
| Cosecha | Sesión por lote, pasada, trabajador, kg, modelo de pago |
| Beneficio | Tolva → pergamino, con etapas que se pueden saltar |
| Pagos | Liquidación semanal o anticipo; desprendible |
| Costos | Fertilización, arvenses, renovación; ficha $/carga |
| Ventas | Pergamino o cereza, ligado a lote o a lote de beneficio |
| Finanzas | Margen por lote, equilibrio, sensibilidad |

## Desarrollo

```bash
npm install
npm run dev
```

La app escucha en el puerto 8080. `npm run typecheck` y `npm run build` deben pasar antes de publicar.

## Identidad

Caturra / Castillo · 1.900 m s.n.m. · Cerro La Jabonera, Santander.
