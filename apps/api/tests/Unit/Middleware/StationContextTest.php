<?php

namespace Tests\Unit\Middleware;

use App\Http\Middleware\CheckStationRole;
use App\Http\Middleware\EnsureStationContext;
use App\Models\Entidad;
use App\Models\Municipio;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class StationContextTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
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
        
        $this->user = User::factory()->create();
    }

    public function test_ensure_station_context_middleware_validates_access()
    {
        $middleware = new EnsureStationContext();
        
        // Create request with station_numero
        $request = Request::create('/api/test', 'GET', [
            'station_numero' => $this->station->numero
        ]);
        $request->setUserResolver(fn() => $this->user);

        // Test without station access
        $response = $middleware->handle($request, function ($req) {
            return response('success');
        });

        $this->assertEquals(403, $response->getStatusCode());
        
        // Add station access
        $this->user->stations()->attach($this->station->numero, ['role' => 'viewer']);
        
        // Test with station access
        $response = $middleware->handle($request, function ($req) {
            return response('success');
        });

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_ensure_station_context_accepts_header_parameter()
    {
        $middleware = new EnsureStationContext();
        
        // Create request with header
        $request = Request::create('/api/test', 'GET');
        $request->headers->set('X-Station-Numero', $this->station->numero);
        $request->setUserResolver(fn() => $this->user);

        $this->user->stations()->attach($this->station->numero, ['role' => 'owner']);
        
        $response = $middleware->handle($request, function ($req) {
            // Check that station context was added
            $this->assertNotNull($req->input('current_station'));
            $this->assertEquals('owner', $req->input('station_role'));
            return response('success');
        });

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_check_station_role_middleware_validates_roles()
    {
        $middleware = new CheckStationRole();
        
        $request = Request::create('/api/test', 'GET', [
            'station_numero' => $this->station->numero
        ]);
        $request->setUserResolver(fn() => $this->user);

        // Test with viewer role trying to access owner endpoint
        $this->user->stations()->attach($this->station->numero, ['role' => 'viewer']);
        
        $response = $middleware->handle($request, function ($req) {
            return response('success');
        }, 'owner');

        $this->assertEquals(403, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertEquals('INSUFFICIENT_ROLE', $data['error']['code']);
        
        // Update to owner role
        $this->user->stations()->updateExistingPivot($this->station->numero, ['role' => 'owner']);
        
        $response = $middleware->handle($request, function ($req) {
            return response('success');
        }, 'owner');

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_check_station_role_accepts_multiple_roles()
    {
        $middleware = new CheckStationRole();
        
        $request = Request::create('/api/test', 'GET', [
            'station_numero' => $this->station->numero
        ]);
        $request->setUserResolver(fn() => $this->user);

        // Test with manager role for owner,manager endpoint
        $this->user->stations()->attach($this->station->numero, ['role' => 'manager']);
        
        $response = $middleware->handle($request, function ($req) {
            return response('success');
        }, 'owner', 'manager');

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_middleware_returns_error_when_station_numero_missing()
    {
        $middleware = new CheckStationRole();
        
        $request = Request::create('/api/test', 'GET');
        $request->setUserResolver(fn() => $this->user);

        $response = $middleware->handle($request, function ($req) {
            return response('success');
        }, 'owner');

        $this->assertEquals(422, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertEquals('MISSING_STATION', $data['error']['code']);
    }

    public function test_middleware_handles_unauthenticated_users()
    {
        $middleware = new CheckStationRole();
        
        $request = Request::create('/api/test', 'GET', [
            'station_numero' => $this->station->numero
        ]);
        $request->setUserResolver(fn() => null);

        $response = $middleware->handle($request, function ($req) {
            return response('success');
        }, 'owner');

        $this->assertEquals(401, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertEquals('UNAUTHENTICATED', $data['error']['code']);
    }

    public function test_middleware_gets_station_from_route_parameter()
    {
        $middleware = new CheckStationRole();
        
        $request = Request::create('/api/test/123', 'GET');
        $request->setRouteResolver(function() {
            $route = new \Illuminate\Routing\Route('GET', 'test/{numero}', []);
            $route->bind($request = Request::create('/api/test/123'));
            $route->setParameter('numero', $this->station->numero);
            return $route;
        });
        $request->setUserResolver(fn() => $this->user);

        $this->user->stations()->attach($this->station->numero, ['role' => 'owner']);
        
        $response = $middleware->handle($request, function ($req) {
            return response('success');
        }, 'owner');

        $this->assertEquals(200, $response->getStatusCode());
    }
}