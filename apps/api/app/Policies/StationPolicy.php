<?php

namespace App\Policies;

use App\Models\Station;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class StationPolicy
{
    use HandlesAuthorization;

    /**
     * Determine if the user can view the station.
     */
    public function view(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->exists();
    }

    /**
     * Determine if the user can manage prices for the station.
     */
    public function managePrices(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine if the user can view analytics for the station.
     */
    public function viewAnalytics(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivotIn('role', ['owner', 'manager'])
            ->exists();
    }

    /**
     * Determine if the user can view advanced analytics for the station.
     */
    public function viewAdvancedAnalytics(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine if the user can manage alerts for the station.
     */
    public function manageAlerts(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine if the user can view alerts for the station.
     */
    public function viewAlerts(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivotIn('role', ['owner', 'manager'])
            ->exists();
    }

    /**
     * Determine if the user can update station settings.
     */
    public function updateSettings(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine if the user can assign other users to the station.
     */
    public function assignUsers(User $user, Station $station): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Check if user has a specific role for a station.
     */
    public function hasRole(User $user, Station $station, string $role): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivot('role', $role)
            ->exists();
    }

    /**
     * Check if user has at least one of the specified roles.
     */
    public function hasAnyRole(User $user, Station $station, array $roles): bool
    {
        return $user->stations()
            ->where('station_numero', $station->numero)
            ->wherePivotIn('role', $roles)
            ->exists();
    }
}