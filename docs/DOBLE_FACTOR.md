# Verificación en dos pasos (2FA) del panel

Las cuentas que ingresan al panel (el administrador y las cuentas de solo lectura) pueden —y, una vez activada la
exigencia, tienen que— verificar un código de 6 dígitos de una app autenticadora además de la contraseña. Usa el MFA TOTP
nativo de Supabase Auth. Los postulantes **no** usan 2FA: entran con el enlace firmado de su evaluación.

## Cómo funciona
- Después de la contraseña la sesión es `aal1`; al verificar el código pasa a `aal2` (el token lleva `aal: "aal2"`).
- `MFA_OBLIGATORIO=true` (variable de entorno de Vercel) hace que el servidor exija `aal2` en todas las rutas de
  administración: `requireAdminSession` (`lib/server/adminAuth.ts`) y, como segunda barrera sin red, `proxy.ts`
  (`decidirAccesoApi` en `lib/server/rutasApi.ts`). Única excepción: `/api/admin/whoami`, que admite `aal1` para que la
  pantalla sepa a dónde mandar a la cuenta. Apagada por defecto en el código; **activada en Producción el 2026-10-02**.
- Pantallas: `/seguridad` (agregar o quitar dispositivos), `/login/2fa` (pedir el código al ingresar) y
  `lib/useGateMfa.ts` (en `AppLayout` y en el informe: manda a `/login/2fa`, o a `/seguridad` si la cuenta aún no tiene
  dispositivo, cuando la exigencia está activa y la sesión es `aal1`).
- Supabase limita a 15 por minuto la creación y verificación de desafíos MFA.

## Puesta en marcha (orden recomendado)
1. En Supabase: Authentication → Sign In / Providers → **Multi-Factor**: TOTP habilitado (enroll y verify).
2. Con la exigencia **apagada**, cada persona entra a **Seguridad** (menú del panel, o `/seguridad`) y agrega **al menos
   dos dispositivos** (teléfono + uno de respaldo). No hay códigos de recuperación.
3. Probar: cerrar sesión, ingresar, escribir el código en la pantalla de verificación, y entrar al panel.
4. Recién entonces, en Vercel → Settings → Environment Variables: `MFA_OBLIGATORIO=true` (Production) y **redesplegar**.
5. Las sesiones que estaban abiertas pasan a `aal1` y se redirigen a verificar el código; no se pierde nada.

## Marcha atrás
Quitar la variable `MFA_OBLIGATORIO` (o ponerla en `false`) y redesplegar: el servidor deja de exigir `aal2` y todo
vuelve a funcionar solo con contraseña. Los dispositivos ya enrolados siguen existiendo.

## Si alguien pierde el dispositivo
- **Cuenta de solo lectura**: el administrador va a **Accesos → Restablecer 2FA** de esa cuenta. Se borran sus
  dispositivos y se cierran sus sesiones; en el próximo ingreso configura uno nuevo.
- **El administrador** (si perdió todos sus dispositivos): Supabase Dashboard → Authentication → Users → su usuario →
  eliminar los factores (o `auth.admin.mfa.deleteFactor`). Por eso se recomiendan dos dispositivos.

## Lo que no cubre
- No impide que alguien con la sesión **ya verificada** (por ejemplo, con el navegador desbloqueado) siga usándola.
- La sesión sigue guardada en `localStorage` del navegador (punto aparte: pasarla a cookies httpOnly).
- La fuerza bruta del código está acotada por el límite de Supabase y por requerir primero la contraseña
  (`/api/login` ya bloquea tras 5 intentos fallidos por email); si se quisiera más, se puede sumar un
  "MFA Verification Hook" en Supabase.
