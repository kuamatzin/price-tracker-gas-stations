<?php

namespace App\Telegram\Commands;

use App\Services\Telegram\CommandRegistry;

class UnknownCommand extends BaseCommand
{
    /**
     * @var string Command Name
     */
    protected $name = 'unknown';

    /**
     * @var string Command Description
     */
    protected $description = 'Maneja comandos no reconocidos';

    /**
     * Execute the command
     */
    public function handle(): void
    {
        $message = $this->getUpdate()->getMessage();
        $text = $message->getText();
        $chatId = $this->getChatId();
        
        // Extract command from text
        $command = str_replace('/', '', explode(' ', $text)[0]);
        $command = str_replace('@' . config('telegram.bots.fuelintel.username'), '', $command);
        
        // Get command registry to find similar commands
        $registry = app(CommandRegistry::class);
        $suggestions = $registry->getSimilar($command);
        
        $responseText = "❌ No reconozco el comando `/{$command}`\n\n";
        
        if (!empty($suggestions)) {
            $responseText .= "*Quizás quisiste decir:*\n";
            foreach ($suggestions as $suggestion) {
                $responseText .= "• `/{$suggestion}`\n";
            }
            $responseText .= "\n";
        }
        
        $responseText .= "Usa /help para ver todos los comandos disponibles.";
        
        $this->replyWithMessage([
            'chat_id' => $chatId,
            'text' => $responseText,
            'parse_mode' => 'Markdown'
        ]);
    }
}