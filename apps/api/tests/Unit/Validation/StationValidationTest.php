<?php

namespace Tests\Unit\Validation;

use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class StationValidationTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $entidad = Entidad::factory()->create();
        $municipio = Municipio::factory()->create(['entidad_id' => $entidad->id]);
        
        $this->station = Station::factory()->create([
            'entidad_id' => $entidad->id,
            'municipio_id' => $municipio->id,
        ]);
    }

    public function test_station_assignment_validation_rules()
    {
        $rules = [
            'station_numero' => 'required|string|exists:stations,numero',
            'role' => 'required|in:owner,manager,viewer',
        ];

        // Valid data
        $data = [
            'station_numero' => $this->station->numero,
            'role' => 'owner',
        ];
        
        $validator = Validator::make($data, $rules);
        $this->assertTrue($validator->passes());

        // Invalid station numero
        $data['station_numero'] = 'INVALID123';
        $validator = Validator::make($data, $rules);
        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('station_numero', $validator->errors()->toArray());

        // Invalid role
        $data = [
            'station_numero' => $this->station->numero,
            'role' => 'invalid_role',
        ];
        $validator = Validator::make($data, $rules);
        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('role', $validator->errors()->toArray());

        // Missing required fields
        $validator = Validator::make([], $rules);
        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('station_numero', $validator->errors()->toArray());
        $this->assertArrayHasKey('role', $validator->errors()->toArray());
    }

    public function test_station_search_validation_rules()
    {
        $rules = [
            'q' => 'nullable|string|min:2',
            'entidad_id' => 'nullable|integer|exists:entidades,id',
            'municipio_id' => 'nullable|integer|exists:municipios,id',
            'per_page' => 'nullable|integer|min:1|max:100',
        ];

        // Valid search query
        $data = [
            'q' => 'PEMEX',
            'per_page' => 20,
        ];
        
        $validator = Validator::make($data, $rules);
        $this->assertTrue($validator->passes());

        // Search query too short
        $data['q'] = 'P';
        $validator = Validator::make($data, $rules);
        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('q', $validator->errors()->toArray());

        // Invalid entidad_id
        $data = [
            'entidad_id' => 99999,
        ];
        $validator = Validator::make($data, $rules);
        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('entidad_id', $validator->errors()->toArray());

        // Per page out of range
        $data = [
            'per_page' => 101,
        ];
        $validator = Validator::make($data, $rules);
        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('per_page', $validator->errors()->toArray());
    }

    public function test_station_numero_format_validation()
    {
        // Station numeros should follow PEMEX/CRE format
        $rules = [
            'station_numero' => ['required', 'string', 'regex:/^[A-Z0-9]{4,10}$/'],
        ];

        // Valid formats
        $validNumeros = ['E12345', 'PL1234', 'CRE567', '12345678'];
        
        foreach ($validNumeros as $numero) {
            $validator = Validator::make(['station_numero' => $numero], $rules);
            $this->assertTrue($validator->passes(), "Failed for numero: {$numero}");
        }

        // Invalid formats
        $invalidNumeros = ['abc', '123', 'e12345', 'TOOLONGSTATIONID', ''];
        
        foreach ($invalidNumeros as $numero) {
            $validator = Validator::make(['station_numero' => $numero], $rules);
            $this->assertFalse($validator->passes(), "Should have failed for numero: {$numero}");
        }
    }

    public function test_duplicate_station_assignment_validation()
    {
        $user = User::factory()->create();
        $user->stations()->attach($this->station->numero, ['role' => 'owner']);

        // Custom validation rule to check duplicates
        $rules = [
            'station_numero' => [
                'required',
                'exists:stations,numero',
                function ($attribute, $value, $fail) use ($user) {
                    if ($user->stations()->where('station_numero', $value)->exists()) {
                        $fail('This station is already assigned to the user.');
                    }
                },
            ],
        ];

        // Try to assign same station again
        $data = ['station_numero' => $this->station->numero];
        $validator = Validator::make($data, $rules);
        
        $this->assertFalse($validator->passes());
        $this->assertStringContainsString('already assigned', 
            $validator->errors()->first('station_numero')
        );

        // Different station should pass
        $newStation = Station::factory()->create([
            'entidad_id' => $this->station->entidad_id,
            'municipio_id' => $this->station->municipio_id,
        ]);
        
        $data = ['station_numero' => $newStation->numero];
        $validator = Validator::make($data, $rules);
        $this->assertTrue($validator->passes());
    }

    public function test_station_context_parameter_validation()
    {
        $rules = [
            'station_numero' => 'required|string|exists:stations,numero',
        ];

        // Valid with station_numero
        $data = ['station_numero' => $this->station->numero];
        $validator = Validator::make($data, $rules);
        $this->assertTrue($validator->passes());

        // Invalid station_numero
        $data = ['station_numero' => 'INVALID'];
        $validator = Validator::make($data, $rules);
        $this->assertFalse($validator->passes());

        // Missing station_numero
        $validator = Validator::make([], $rules);
        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('station_numero', $validator->errors()->toArray());
    }
}