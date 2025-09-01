👋 *¡Bienvenido a FuelIntel!*

Tu sistema de notificaciones está configurado correctamente.

📋 *Resumen de tu configuración:*
• 📍 Estación principal: {{ $station_name }}
• 📏 Radio de monitoreo: {{ $radius_km }} km
• 🎯 Umbral de alerta: {{ $threshold }}
• ⛽ Combustibles monitoreados: {{ implode(', ', $fuel_types) }}
• ⏰ Resumen diario: {{ $summary_time ?? 'Desactivado' }}

🔔 *Notificaciones activadas:*
@if($daily_summary_enabled)
✅ Resumen diario
@else
⬜ Resumen diario
@endif
@if($price_alerts_enabled)
✅ Alertas de precio
@else
⬜ Alertas de precio
@endif
@if($recommendations_enabled)
✅ Recomendaciones inteligentes
@else
⬜ Recomendaciones inteligentes
@endif

📝 *Comandos disponibles:*
• /precios - Ver precios actuales
• /analisis - Análisis detallado
• /configurar - Cambiar preferencias
• /notificaciones - Ajustar notificaciones
• /silencio - Pausar notificaciones
• /ayuda - Ver todos los comandos

¡Comenzarás a recibir notificaciones según tu configuración!