<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Station extends Model
{
    use HasFactory;

    protected $primaryKey = 'numero';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'numero',
        'nombre',
        'franquicia',
        'direccion',
        'entidad_id',
        'municipio_id',
        'coordenadas',
        'is_active',
    ];

    protected $casts = [
        'coordenadas' => 'array',
        'is_active' => 'boolean',
    ];

    public function municipio()
    {
        return $this->belongsTo(Municipio::class, 'municipio_id', 'municipio_id');
    }

    public function users()
    {
        return $this->hasMany(UserStation::class, 'station_numero', 'numero');
    }

    public function priceChanges()
    {
        return $this->hasMany(PriceChange::class, 'station_numero', 'numero');
    }
}
