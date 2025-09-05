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
        'direccion',
        'lat',
        'lng',
        'entidad_id',
        'municipio_id',
        'brand',
        'is_active',
    ];

    protected $casts = [
        'lat' => 'decimal:8',
        'lng' => 'decimal:8',
        'is_active' => 'boolean',
    ];

    public function municipio()
    {
        return $this->belongsTo(Municipio::class, 'municipio_id', 'id');
    }

    public function users()
    {
        return $this->belongsToMany(
            User::class,
            'user_stations',
            'station_numero',
            'user_id',
            'numero',
            'id'
        )->withPivot('role')->withTimestamps();
    }

    public function priceChanges()
    {
        return $this->hasMany(PriceChange::class, 'station_numero', 'numero');
    }
}
