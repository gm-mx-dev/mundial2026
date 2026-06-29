# Quiniela Mundial 2026 — Contexto del Proyecto

## Descripción General

App web para administrar la Quiniela del Mundial FIFA 2026 para un grupo familiar de 18 participantes. Bolsa de $9,000 MXN. Mobile-first, dark mode, totalmente en español.

## Stack Tecnológico

- **Frontend**: Next.js 15 (App Router, TypeScript)
- **Estilos**: Tailwind CSS (mobile-first, responsive automático con breakpoints CSS — sin JS de detección)
- **Componentes**: shadcn/ui
- **Base de datos**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Auth**: Supabase Auth con Google OAuth (login de 1 clic)
- **Deploy**: Vercel (CI/CD automático desde GitHub)
- **API resultados**: football-data.org (free tier, cron cada 5 min via Supabase Edge Function)
- **Tests**: Playwright
- **MCPs**: GitHub MCP, Supabase MCP, Playwright MCP

## Repositorio y Deploy

- **GitHub**: https://github.com/gm-mx-dev/mundial2026
- **Deploy**: Vercel conectado al repo de GitHub (auto-deploy en cada push)
- **URL app**: https://mundial2026.vercel.app (o la que asigne Vercel)

## Los 18 Participantes

Todos confirmados y pagados ($500 MXN cada uno):

| # | Nombre | Estado |
|---|--------|--------|
| 1 | ADRIAN | activo |
| 2 | ANGEL | activo |
| 3 | ANUAR | activo |
| 4 | CHRIS | activo |
| 5 | DON TANIS | activo (sin celular — admin captura sus pronósticos) |
| 6 | GIO | activo |
| 7 | INGRID | activo |
| 8 | IRIS | activo |
| 9 | JAKUB | activo |
| 10 | LUIS | activo |
| 11 | MARCE | activo |
| 12 | MARY | activo |
| 13 | MIGUEL | activo |
| 14 | TANIA | activo |
| 15 | UBALDO | activo (admin principal) |
| 16 | WICHO | activo |
| 17 | TOÑO | activo (sin celular — admin captura sus pronósticos) |
| 18 | YAZMIN | activo |

## Bolsa y Premios

- **Bolsa total**: $9,000 MXN (18 × $500)
- **1er lugar**: $5,400 MXN (60%)
- **2do lugar**: $2,250 MXN (25%)
- **3er lugar**: $1,350 MXN (15%)
- **Nota**: Si un participante es desactivado, la bolsa y premios se recalculan automáticamente.

## Fases y Partidos

### Fase 1: 16avos de Final (16 partidos)
1. Sudáfrica vs Canadá
2. Alemania vs Paraguay
3. Francia vs Suecia
4. Países Bajos vs Marruecos
5. Portugal vs Croacia
6. España vs Austria
7. Estados Unidos vs Bosnia H.
8. Bélgica vs Senegal
9. Brasil vs Japón
10. C. Marfil vs Noruega
11. México vs Ecuador
12. Inglaterra vs RD Congo
13. Argentina vs Cabo Verde
14. Australia vs Egipto
15. Suiza vs Argelia
16. Colombia vs Ghana

### Fase 2: Octavos de Final (8 partidos)
### Fase 3: Cuartos de Final (4 partidos)
### Fase 4: Semifinal (2 partidos)
### Fase 5: Tercer Lugar (1 partido)
### Fase 6: Final (1 partido)

**Total: 32 partidos**

Los partidos de Octavos en adelante se definen conforme avanza el torneo (por posición: ganador partido 1 vs ganador partido 2, etc.).

## Reglas de Puntuación

- **Marcador exacto**: 2 puntos
- **Resultado correcto** (solo el ganador o empate, sin el marcador exacto): 1 punto
- **Pronóstico incorrecto**: 0 puntos
- **Bonus campeón**: 5 puntos extra si el participante acertó al campeón del mundial

### Desempate (en caso de empate en puntos totales)
1. Quien tenga más aciertos exactos
2. Quien haya acertado al campeón
3. Dividir el premio entre los empatados

## Pronósticos de Campeón (datos reales del Excel)

- FRANCIA: 7 participantes
- ARGENTINA: 4 participantes
- PAÍSES BAJOS: 3 participantes
- BRASIL: 2 participantes
- ALEMANIA: 1 participante
- ESPAÑA: 1 participante

## Reglas de Tiempo

- Los pronósticos se pueden capturar **antes de que empiece el primer partido de cada fase**
- Una vez que empieza el primer partido de la fase, los pronósticos se bloquean automáticamente
- Cada partido se bloquea individualmente a su hora de kickoff
- Solo el admin puede ingresar pronósticos fuera de tiempo, con razón obligatoria (queda en bitácora)

## Roles de Usuario

### Participante (usuario normal)
- Capturar sus propios pronósticos (auto-save por partido)
- Ver su ranking y puntos
- Ver los pronósticos de los demás **solo después de que empieza el primer partido de la fase**
- Ver su historial de pronósticos
- Ver la tabla de posiciones en tiempo real

### Administrador (puede haber varios)
- Todo lo del participante
- Capturar resultados oficiales de los partidos
- **Ingresar pronósticos por otro participante** (queda registrado en bitácora)
- **Activar o desactivar participantes** (si no paga → desactivar; si paga → activar)
- Ver y filtrar la bitácora completa de cambios
- Override de tiempo (ingresar pronóstico fuera de plazo con razón obligatoria)
- Ver panel de administración con estado de la app

## Funcionalidad: Activar/Desactivar Participantes

### Comportamiento al desactivar
- El participante no puede iniciar sesión
- No aparece en la tabla de posiciones
- La bolsa se recalcula: `participantes_activos × $500`
- Los premios se recalculan automáticamente
- Sus pronósticos se conservan (no se borran)
- La acción queda registrada en la bitácora

### Comportamiento al reactivar
- El participante puede volver a entrar
- Reaparece en el ranking
- La bolsa sube de nuevo
- Sus pronósticos anteriores siguen vigentes
- La acción queda registrada en la bitácora

### UI Admin
- Panel "Participantes" con lista de los 18
- Toggle de activo/inactivo por participante
- Indicador visual del estado (verde = activo, rojo = desactivado)
- Mostrar bolsa total actualizada en tiempo real

## Funcionalidad: Ingresar por Otro Participante (Admin)

El admin puede seleccionar a cualquier participante y capturar sus pronósticos como si fuera él. Cada acción queda registrada automáticamente en la bitácora con:
- Usuario que hizo el cambio (admin)
- Participante por quien se capturó
- Partido y pronóstico
- Timestamp
- Tipo de acción: "ingresado por admin"

## Bitácora de Cambios (Audit Log)

Toda acción en la app queda registrada. La bitácora incluye:
- Usuario que realizó la acción
- Tipo de acción (capturar pronóstico, modificar pronóstico, capturar resultado, activar/desactivar participante, override de tiempo)
- Datos antes y después del cambio
- Timestamp
- Razón (obligatoria para overrides y desactivaciones)

Filtros disponibles: por usuario, por tipo de acción, por fecha, por partido/fase.

## Auto-save y Sincronización

- Cada pronóstico se guarda a Supabase **inmediatamente** al cambiar (sin botón de enviar)
- Confirmación visual instantánea (checkmark o color)
- Supabase Realtime actualiza el ranking y puntos en todos los dispositivos conectados sin recargar
- La API de football-data.org se consulta cada 5 minutos via Supabase Edge Function (cron job)

## Diseño y UX

### Responsive (automático, solo CSS)
- **Móvil** (< 768px): navegación en tabs horizontales en la parte superior, layouts en columna
- **Tablet** (768px–1024px): sidebar de navegación + contenido principal
- **Desktop** (> 1024px): sidebar + contenido amplio con múltiples columnas

**No usar JavaScript para detección de dispositivo. Solo Tailwind breakpoints (`sm:`, `md:`, `lg:`).**

### Pantalla principal (primera impresión)
- Quien va ganando actualmente (top 3)
- Bolsa total y premios
- Cuenta regresiva al siguiente partido
- Acceso rápido a capturar pronósticos

### Dark mode
- Forzado siempre (no toggle de light/dark mode)
- Paleta oscura consistente en toda la app

### Idioma
- Todo en español
- Sin términos técnicos en inglés para el usuario

## PWA (Progressive Web App)

Configurar la app como PWA para que los usuarios puedan instalarla en su pantalla de inicio sin App Store:
- `manifest.json` con nombre, ícono e idioma
- Service Worker básico para offline fallback
- Meta tags para iOS y Android

## Variables de Entorno Necesarias

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# API de resultados
FOOTBALL_DATA_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://mundial2026.vercel.app
```

## Primer Comando en Claude Code

Una vez configurados los MCPs y las variables de entorno, ejecutar:

```
Crea el proyecto completo de Quiniela Mundial 2026 siguiendo el CLAUDE.md. 
Usa el MCP de Supabase para crear toda la base de datos (schema.sql ya está en el repo).
Usa el MCP de GitHub para subir el código.
Empieza por: scaffold Next.js → instalar dependencias → crear DB en Supabase → importar los 18 participantes con sus pronósticos de 16avos → página principal → ranking → captura de pronósticos → panel admin.
```

## Datos Reales a Importar (del Excel)

Los pronósticos de los 18 participantes para la fase de 16avos ya están capturados en el archivo Excel original (`Quiniela mundial 2026.xlsx`). Importarlos a la tabla `predictions` al inicializar la app.

El resultado ya registrado: **Sudáfrica 0 - 1 Canadá** (primer partido jugado).
