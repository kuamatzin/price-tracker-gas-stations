<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserStation extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'station_numero',
        'role',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function station()
    {
        return $this->belongsTo(Station::class, 'station_numero', 'numero');
    }
}