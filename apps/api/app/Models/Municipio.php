<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Municipio extends Model
{
    use HasFactory;

    protected $fillable = [
        'id',
        'nombre',
        'entidad_id',
    ];

    public function entidad()
    {
        return $this->belongsTo(Entidad::class, 'entidad_id', 'id');
    }

    public function stations()
    {
        return $this->hasMany(Station::class, 'municipio_id', 'id');
    }
}