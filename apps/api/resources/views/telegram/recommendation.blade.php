💡 *Recomendación Inteligente*

@if($title)
📌 {{ $title }}
@endif

{{ $recommendation }}

@if($data_points && count($data_points) > 0)
📊 *Datos relevantes:*
@foreach($data_points as $point)
• {{ $point }}
@endforeach
@endif

@if($savings_potential)
💵 *Ahorro potencial:* {{ $savings_potential }}
@endif

@if($best_time)
⏰ *Mejor momento:* {{ $best_time }}
@endif

@if($stations && count($stations) > 0)
🏪 *Estaciones recomendadas:*
@foreach($stations as $station)
• {{ $station['name'] }}: ${{ number_format($station['price'], 2) }} @if($station['savings'])(Ahorro: ${{ number_format($station['savings'], 2) }})@endif
@endforeach
@endif

@if($confidence_level)
📈 *Nivel de confianza:* {{ $confidence_level }}
@endif

_Basado en tu historial y preferencias_

@if($actions && count($actions) > 0)
*¿Qué hacer ahora?*
@foreach($actions as $action)
{{ $loop->iteration }}. {{ $action }}
@endforeach
@endif

Para más análisis usa /analisis
Para ajustar preferencias usa /configurar