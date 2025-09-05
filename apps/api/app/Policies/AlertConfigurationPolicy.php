<?php

namespace App\Policies;

use App\Models\AlertConfiguration;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class AlertConfigurationPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        // Users can view their own alerts
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, AlertConfiguration $alertConfiguration): bool
    {
        // User can only view their own alerts
        return $user->id === $alertConfiguration->user_id;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        // Only owners can create alerts
        return $user->stations()
            ->wherePivot('role', 'owner')
            ->exists();
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, AlertConfiguration $alertConfiguration): bool
    {
        // User must own the alert and have owner role for at least one station
        return $user->id === $alertConfiguration->user_id &&
            $user->stations()
                ->wherePivot('role', 'owner')
                ->exists();
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, AlertConfiguration $alertConfiguration): bool
    {
        // User must own the alert and have owner role for at least one station
        return $user->id === $alertConfiguration->user_id &&
            $user->stations()
                ->wherePivot('role', 'owner')
                ->exists();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, AlertConfiguration $alertConfiguration): bool
    {
        return $user->id === $alertConfiguration->user_id &&
            $user->stations()
                ->wherePivot('role', 'owner')
                ->exists();
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, AlertConfiguration $alertConfiguration): bool
    {
        return $user->id === $alertConfiguration->user_id &&
            $user->stations()
                ->wherePivot('role', 'owner')
                ->exists();
    }
}