# Validacion funcional v1.0.0

## Estado actual

Servidor local validado en:
- http://127.0.0.1:4173/index.html
- http://127.0.0.1:4174/manifest.webmanifest (fallback automatico por puerto ocupado)

Flujo local con Node validado:
- npm.cmd test: OK
- node server.js con fallback de puerto: OK

Recursos PWA servidos correctamente:
- index.html: OK
- manifest.webmanifest: OK
- sw.js: OK

Validacion automatizada del motor:
- validate_engine.js: OK
- Redondeo de facturacion por 10 cm: OK
- Normalizacion de ancho util: OK
- Caso base simple/optimizado: OK
- Deteccion de diseño fuera de ancho util: OK
- Caso mixto optimizado: OK

Validacion automatizada de persistencia:
- validate_persistence.js: OK
- Fallback a configuracion base: OK
- Saneamiento de configuracion corrupta: OK
- Saneamiento de formulario corrupto: OK
- Recuperacion de diseños por defecto: OK

## Checklist funcional

### 1. Calculo principal
- [ ] Validar largo calculado con un solo diseno
- [ ] Validar largo calculado con varios disenos
- [ ] Validar rotacion activada
- [ ] Validar rotacion desactivada
- [ ] Validar error cuando un diseno no cabe en el ancho util

### 2. Costeo
- [ ] Validar precio lineal por ancho 30 cm
- [ ] Validar precio lineal por ancho 45 cm
- [ ] Validar precio lineal por ancho 60 cm
- [ ] Validar costo fijo
- [ ] Validar metraje facturable con saltos de 10 cm
- [ ] Caso control: 0.25 m debe facturar 0.3 m
- [ ] Caso control: 0.84 m debe facturar 0.9 m
- [ ] Caso control: 3.38 m debe facturar 3.4 m

### 3. Configuracion
- [ ] Validar guardado de margen lateral
- [ ] Validar guardado de separacion por defecto
- [ ] Validar guardado de costos y tarifas
- [ ] Validar restauracion de configuracion base
- [ ] Validar borrado manual de datos locales
- [ ] Validar recuperacion segura si localStorage tiene datos corruptos

### 4. UI y flujo
- [ ] Abrir y cerrar panel de configuracion
- [ ] Agregar diseno rapido
- [ ] Agregar fila vacia
- [ ] Quitar diseno
- [ ] Restablecer formulario
- [ ] Exportar imagen
- [ ] Exportar orden
- [ ] Abrir como app instalada

### 5. Comparacion entre anchos
- [ ] Validar mejor ancho por desperdicio
- [ ] Validar mejor ancho por costo
- [ ] Validar mejor ancho por ganancia
- [ ] Validar marcado del ancho actual

## Riesgos pendientes antes de cierre final
- Falta validacion manual real de interfaz en movil.
- Falta comprobar persistencia completa de localStorage durante recargas.
- Falta validar instalacion real como PWA en navegador objetivo.
- El cierre productivo final debe quedar para la ultima fase.
