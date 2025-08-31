<?php

namespace Tests\Integration\Telegram;

use Tests\TestCase;
use App\Services\Telegram\NlpProcessor;
use App\Services\External\DeepSeekService;
use App\Services\Telegram\TelegramSession;
use App\Services\Telegram\SessionManager;
use App\Repositories\NlpQueryRepository;
use App\Jobs\LogNlpQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Config;

class NlpIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected NlpProcessor $processor;
    protected SessionManager $sessionManager;
    protected NlpQueryRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        
        Config::set('deepseek.api_key', 'test-key');
        Config::set('deepseek.api_url', 'https://api.deepseek.com/v1');
        Config::set('deepseek.timeout_seconds', 2);
        Config::set('deepseek.confidence_threshold', 0.7);
        Config::set('deepseek.context_ttl_seconds', 300);
        
        $this->processor = app(NlpProcessor::class);
        $this->sessionManager = app(SessionManager::class);
        $this->repository = app(NlpQueryRepository::class);
    }

    public function test_nlp_processing_with_deepseek_integration()
    {
        Http::fake([
            'api.deepseek.com/v1/models' => Http::response(['models' => []], 200),
            'api.deepseek.com/v1/chat/completions' => Http::response([
                'choices' => [
                    ['message' => ['content' => json_encode([
                        'intent' => 'price_query',
                        'entities' => ['fuel_type' => 'premium'],
                        'confidence' => 0.95,
                        'suggested_command' => '/precio premium'
                    ])]]
                ]
            ], 200)
        ]);
        
        $result = $this->processor->process('quiero saber el precio del combustible rojo');
        
        $this->assertTrue($result['used_deepseek']);
        $this->assertEquals('price_query', $result['intent']);
        $this->assertEquals('premium', $result['entities']['fuel_type']);
        $this->assertEquals(0.95, $result['confidence']);
        $this->assertEquals('/precio premium', $result['suggested_command']);
    }

    public function test_session_context_persistence_in_redis()
    {
        Redis::shouldReceive('setex')
            ->once()
            ->with('telegram:session:12345', 1800, \Mockery::any())
            ->andReturn(true);
        
        Redis::shouldReceive('get')
            ->once()
            ->with('telegram:session:12345')
            ->andReturn(json_encode([
                'user_id' => 12345,
                'conversation_context' => [
                    'intent' => 'price_query',
                    'entities' => ['fuel_type' => 'regular'],
                    'updated_at' => time() - 100
                ]
            ]));
        
        $session = $this->sessionManager->get(12345);
        
        $this->assertInstanceOf(TelegramSession::class, $session);
        $this->assertEquals('price_query', $session->getLastIntent());
        $this->assertEquals('regular', $session->getLastEntities()['fuel_type']);
        
        // Test context merging
        $session->mergeConversationContext([
            'intent' => 'station_search',
            'entities' => ['location' => 'centro']
        ]);
        
        $this->sessionManager->save(12345, $session);
        
        $context = $session->getConversationContext();
        $this->assertEquals('station_search', $context['intent']);
        $this->assertEquals('price_query', $context['last_intent']);
        $this->assertEquals('regular', $context['entities']['fuel_type']);
        $this->assertEquals('centro', $context['entities']['location']);
    }

    public function test_query_logging_to_database()
    {
        Queue::fake();
        
        $queryData = [
            'user_id' => 1,
            'chat_id' => '12345',
            'original_query' => '¿Cuánto está la gasolina premium?',
            'normalized_query' => 'cuánto está la gasolina premium',
            'interpreted_intent' => 'price_query',
            'extracted_entities' => ['fuel_type' => 'premium'],
            'confidence' => 0.85,
            'response_time_ms' => 150,
            'used_deepseek' => false,
            'suggested_command' => '/precio premium'
        ];
        
        dispatch(new LogNlpQuery($queryData));
        
        Queue::assertPushed(LogNlpQuery::class, function ($job) use ($queryData) {
            // Can't directly access job properties, but we can test that it was dispatched
            return true;
        });
        
        // Test direct repository insertion
        $id = $this->repository->create($queryData);
        
        $this->assertIsInt($id);
        $this->assertDatabaseHas('nlp_queries', [
            'id' => $id,
            'chat_id' => '12345',
            'interpreted_intent' => 'price_query',
            'confidence' => 0.85
        ]);
    }

    public function test_context_expiry_after_ttl()
    {
        $session = new TelegramSession();
        
        // Set context with past timestamp
        $session->setConversationContext([
            'intent' => 'price_query',
            'entities' => ['fuel_type' => 'regular'],
            'updated_at' => time() - 400 // 400 seconds ago
        ]);
        
        // Check if expired (default 300 seconds)
        $this->assertTrue($session->isContextExpired());
        
        // Clear expired context
        $session->clearExpiredContext();
        
        $this->assertEmpty($session->getConversationContext());
    }

    public function test_multi_turn_conversation_flow()
    {
        $session = new TelegramSession();
        
        // First turn - ask about premium
        $result1 = $this->processor->process('¿Cuánto está la premium?');
        $session->mergeConversationContext([
            'intent' => $result1['intent'],
            'entities' => $result1['entities']
        ]);
        
        $this->assertEquals('premium', $session->getLastEntities()['fuel_type']);
        
        // Second turn - follow-up about regular
        $context = $session->getConversationContext();
        $result2 = $this->processor->process('¿y la regular?', $context);
        
        $this->assertTrue($this->processor->isFollowUpQuery('¿y la regular?'));
        $this->assertEquals('price_query', $result2['intent']);
        $this->assertEquals('regular', $result2['entities']['fuel_type']);
        
        // Update session with new context
        $session->mergeConversationContext([
            'intent' => $result2['intent'],
            'entities' => $result2['entities']
        ]);
        
        $this->assertEquals('regular', $session->getLastEntities()['fuel_type']);
        $this->assertEquals('price_query', $session->getLastIntent());
    }

    public function test_query_statistics_aggregation()
    {
        // Insert test data
        $queries = [
            ['intent' => 'price_query', 'confidence' => 0.9, 'success' => true, 'used_deepseek' => false],
            ['intent' => 'price_query', 'confidence' => 0.8, 'success' => true, 'used_deepseek' => true],
            ['intent' => 'station_search', 'confidence' => 0.7, 'success' => true, 'used_deepseek' => false],
            ['intent' => 'unknown', 'confidence' => 0.3, 'success' => false, 'used_deepseek' => true],
        ];
        
        foreach ($queries as $query) {
            $this->repository->create([
                'chat_id' => '12345',
                'original_query' => 'test query',
                'interpreted_intent' => $query['intent'],
                'confidence' => $query['confidence'],
                'success' => $query['success'],
                'used_deepseek' => $query['used_deepseek'],
                'response_time_ms' => 100
            ]);
        }
        
        $stats = $this->repository->getStatistics(24);
        
        $this->assertEquals(4, $stats['total_queries']);
        $this->assertEquals(0.68, $stats['avg_confidence']); // (0.9 + 0.8 + 0.7 + 0.3) / 4
        $this->assertEquals(50.0, $stats['deepseek_usage_rate']); // 2 out of 4
        $this->assertEquals(75.0, $stats['success_rate']); // 3 out of 4
        $this->assertEquals(2, $stats['intent_breakdown']['price_query']);
        $this->assertEquals(1, $stats['intent_breakdown']['station_search']);
    }

    public function test_unrecognized_queries_retrieval()
    {
        // Insert queries with varying confidence
        $this->repository->create([
            'chat_id' => '12345',
            'original_query' => 'algo raro',
            'interpreted_intent' => 'unknown',
            'confidence' => 0.2
        ]);
        
        $this->repository->create([
            'chat_id' => '12346',
            'original_query' => 'texto ambiguo',
            'interpreted_intent' => 'price_query',
            'confidence' => 0.5
        ]);
        
        $this->repository->create([
            'chat_id' => '12347',
            'original_query' => 'precio premium',
            'interpreted_intent' => 'price_query',
            'confidence' => 0.9
        ]);
        
        $unrecognized = $this->repository->getUnrecognizedQueries(24);
        
        $this->assertCount(2, $unrecognized);
        $this->assertTrue($unrecognized->contains('original_query', 'algo raro'));
        $this->assertTrue($unrecognized->contains('original_query', 'texto ambiguo'));
        $this->assertFalse($unrecognized->contains('original_query', 'precio premium'));
    }

    public function test_conversation_history_tracking()
    {
        $session = new TelegramSession();
        
        // Add multiple exchanges
        for ($i = 1; $i <= 7; $i++) {
            $session->addToHistory("query $i", "response $i");
        }
        
        $history = $session->getConversationHistory();
        
        // Should only keep last 5
        $this->assertCount(5, $history);
        $this->assertEquals('query 3', $history[0]['query']);
        $this->assertEquals('query 7', $history[4]['query']);
    }

    public function test_deepseek_timeout_handling()
    {
        Http::fake([
            'api.deepseek.com/v1/chat/completions' => function () {
                sleep(3); // Exceed 2 second timeout
                return Http::response(['error' => 'timeout'], 504);
            }
        ]);
        
        $service = app(DeepSeekService::class);
        
        $this->expectException(\App\Exceptions\ExternalServiceException::class);
        
        $service->analyze('test query');
    }
}