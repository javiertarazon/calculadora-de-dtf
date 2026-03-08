# Calculadora DTF PRO v1.0.0

Aplicacion web para calcular largo de rollo DTF, acomodo optimizado, metraje facturable, costo estimado y comparacion entre anchos rapidos.

## Estado actual

Version base 1.0.0 preparada como web app instalable.

Incluye:
- calculo de largo para rollo DTF con ancho fijo
- acomodo optimizado de multiples disenos
- comparacion entre anchos 30, 45 y 60 cm
- costeo con metraje facturable por saltos de 10 cm
- configuracion persistente en navegador
- exportacion de imagen y orden de corte
- base PWA con manifest y service worker

## Uso local

Abre `index.html` en un navegador moderno.

Para probar instalacion y service worker, conviene servir la carpeta por HTTP local en vez de abrirla solo como archivo.

Con Node.js instalado, puedes usar el arranque estandar del proyecto:

- `npm start` levanta el servidor estatico local
- `npm test` ejecuta las validaciones del motor y de persistencia

En PowerShell de Windows, si `npm` queda bloqueado por execution policy, usa `npm.cmd start` y `npm.cmd test`.

El servidor intenta usar el puerto 4173. Si ese puerto ya esta ocupado, busca automaticamente uno libre cercano y muestra la URL correcta en consola.

## Fases del proyecto

1. Base responsive estable: completada a nivel base.
2. Preparar instalacion web: en progreso.
3. Validar flujos funcionales: pendiente.
4. Ajustar interfaz movil: pendiente.
5. Pruebas de persistencia: pendiente.
6. Cierre productivo final: pendiente.

## Pendiente antes de cierre de produccion

- validar interfaz real en movil y escritorio
- probar persistencia y service worker en navegadores objetivo
- revisar exportaciones y comportamiento offline
- cerrar empaquetado final de produccion
