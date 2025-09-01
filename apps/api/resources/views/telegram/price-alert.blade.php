🚨 *Alerta de Cambio de Precio*

📍 Estación: {{ $station_alias }}
⏰ {{ $timestamp }}

💰 *Cambios detectados:*
@foreach($price_changes as $change)
{{ $change['emoji'] }} {{ ucfirst($change['fuel_type']) }}: ${{ number_format($change['old_price'], 2) }} → ${{ number_format($change['new_price'], 2) }} ({{ $change['change_text'] }})
@endforeach

@if($threshold_info)
🎯 *Umbral configurado:* {{ $threshold_info }}
@endif

@if($competitor_analysis)
📊 *Comparación con competencia:*
{{ $competitor_analysis }}
@endif

@if($market_context)
📈 *Contexto del mercado:*
{{ $market_context }}
@endif

@if($action_suggestion)
💡 *Sugerencia de acción:*
{{ $action_suggestion }}
@endif

@if($next_alert_info)
⏱️ Próxima alerta: {{ $next_alert_info }}
@endif

_Usa /precios para ver más detalles_
_Para silenciar alertas usa /silencio_