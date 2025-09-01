☀️ *Buenos días! Tu resumen diario*

📍 Estación: {{ $station_alias }}
📅 Fecha: {{ $date }}

💰 *Precios Actuales:*
@foreach($prices as $fuel => $data)
{{ ucfirst($fuel) }}: ${{ number_format($data['price'], 2) }} {{ $data['indicator'] }} {{ $data['change'] }}
@endforeach

@if($ranking)
📊 *Posición Competitiva:*
{{ $ranking }}
@endif

@if($trend_analysis)
📈 *Análisis de Tendencia:*
{{ $trend_analysis }}
@endif

@if($recommendation)
💡 *Recomendación del día:*
{{ $recommendation }}
@endif

@if($nearby_stations && count($nearby_stations) > 0)
🏪 *Estaciones Cercanas:*
@foreach($nearby_stations as $station)
• {{ $station['name'] }}: ${{ number_format($station['price'], 2) }} ({{ $station['distance'] }}km)
@endforeach
@endif

@if($savings_opportunity)
💵 *Oportunidad de Ahorro:*
{{ $savings_opportunity }}
@endif

Para más detalles usa /analisis