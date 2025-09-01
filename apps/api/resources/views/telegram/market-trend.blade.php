📊 *Tendencia del Mercado*

📅 Período: {{ $period }}
📍 Zona: {{ $zone }}

📈 *Resumen de tendencias:*
@foreach($trends as $fuel => $trend)
{{ ucfirst($fuel) }}: {{ $trend['direction'] }} {{ $trend['percentage'] }}% en {{ $trend['period'] }}
@endforeach

@if($price_forecast)
🔮 *Pronóstico (próximos 7 días):*
{{ $price_forecast }}
@endif

@if($market_factors && count($market_factors) > 0)
📰 *Factores del mercado:*
@foreach($market_factors as $factor)
• {{ $factor }}
@endforeach
@endif

@if($historical_comparison)
📆 *Comparación histórica:*
• Vs. semana pasada: {{ $historical_comparison['week'] }}
• Vs. mes pasado: {{ $historical_comparison['month'] }}
• Vs. año pasado: {{ $historical_comparison['year'] }}
@endif

@if($volatility_index)
⚡ *Índice de volatilidad:* {{ $volatility_index }}
@endif

@if($best_days && count($best_days) > 0)
📅 *Mejores días para cargar:*
@foreach($best_days as $day)
• {{ $day['name'] }}: {{ $day['reason'] }}
@endforeach
@endif

@if($regional_comparison)
🗺️ *Comparación regional:*
Tu zona está {{ $regional_comparison }} que el promedio nacional
@endif

_Análisis basado en {{ $data_points }} puntos de datos_

Para configurar alertas de tendencia usa /configurar