<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Carbon\Carbon;

class TrendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'start_date' => 'nullable|date|before_or_equal:today',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'period' => 'nullable|integer|min:1|max:365',
        ];
    }

    protected function prepareForValidation(): void
    {
        $period = $this->period ?? 7;
        
        $this->merge([
            'start_date' => $this->start_date ?? now()->subDays($period)->format('Y-m-d'),
            'end_date' => $this->end_date ?? now()->format('Y-m-d'),
            'period' => $period,
        ]);
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->start_date && $this->end_date) {
                $start = Carbon::parse($this->start_date);
                $end = Carbon::parse($this->end_date);
                
                // Max 365 days for trend analysis
                if ($start->diffInDays($end) > 365) {
                    $validator->errors()->add('date_range', 'Date range cannot exceed 365 days for trend analysis.');
                }
            }
        });
    }
}