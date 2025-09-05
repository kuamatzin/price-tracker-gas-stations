<?php

namespace App\Policies;

use App\Models\PriceChange;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class PriceChangePolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        // All authenticated users with stations can view prices
        return $user->stations()->exists();
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, PriceChange $priceChange): bool
    {
        // User can view if they have access to the station
        return $user->stations()
            ->where('station_numero', $priceChange->station_numero)
            ->exists();
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        // Only owners can create/modify prices
        return $user->stations()
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, PriceChange $priceChange): bool
    {
        // Only owners of the station can update prices
        return $user->stations()
            ->where('station_numero', $priceChange->station_numero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, PriceChange $priceChange): bool
    {
        // Only owners of the station can delete prices
        return $user->stations()
            ->where('station_numero', $priceChange->station_numero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine whether the user can manage prices for a specific station.
     */
    public function manageForStation(User $user, string $stationNumero): bool
    {
        return $user->stations()
            ->where('station_numero', $stationNumero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine whether the user can view prices for a specific station.
     */
    public function viewForStation(User $user, string $stationNumero): bool
    {
        return $user->stations()
            ->where('station_numero', $stationNumero)
            ->exists();
    }
}