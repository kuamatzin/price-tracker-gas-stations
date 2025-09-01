<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PriceChange extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'station_numero',
        'fuel_type',
        'subproducto',
        'price',
        'changed_at',
        'detected_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'changed_at' => 'datetime',
        'detected_at' => 'datetime',
    ];

    public function station()
    {
        return $this->belongsTo(Station::class, 'station_numero', 'numero');
    }
}
