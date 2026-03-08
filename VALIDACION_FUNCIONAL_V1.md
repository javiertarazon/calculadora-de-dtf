# Validacion funcional v1.0.0

## Estado actual

Servidor local validado en:
- http://127.0.0.1:4173/index.html

Recursos PWA servidos correctamente:
- index.html: OK
- manifest.webmanifest: OK
- sw.js: OK

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
