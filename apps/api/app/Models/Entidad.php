<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Entidad extends Model
{
    use HasFactory;

    protected $table = 'entidades';

    protected $fillable = [
        'id',
        'nombre',
        'codigo',
    ];

    public function municipios()
    {
        return $this->hasMany(Municipio::class, 'entidad_id', 'id');
    }

    public function stations()
    {
        return $this->hasMany(Station::class, 'entidad_id', 'id');
    }
}
