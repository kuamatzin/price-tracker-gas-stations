# Telegram Bot Setup Guide

## Step-by-Step Instructions

### 1. Create Your Bot

1. Open Telegram (mobile or desktop app)
2. Search for: **@BotFather**
3. Start a conversation by clicking "Start" or sending `/start`

### 2. Create New Bot

Send these commands to BotFather:

```
/newbot
```

BotFather will ask for:

1. **Bot name:** `FuelIntel Bot` (can be anything)
2. **Bot username:** `FuelIntelBot` or `FuelIntel_Bot` (must end in 'bot')

You'll receive a token like:

```
5678901234:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

**⚠️ SAVE THIS TOKEN SECURELY!**

### 3. Configure Bot Settings

Send these commands to BotFather:

```
/setdescription
```

Then send:

```
🚗 FuelIntel - Track Mexican gas prices in real-time
Get instant alerts when prices change at your favorite stations
```

```
/setabouttext
```

Then send:

```
FuelIntel helps you save money on gas by tracking prices across Mexico and sending you alerts when prices drop at stations you care about.
```

```
/setcommands
```

Then send:

```
start - Iniciar bot / Start bot
help - Mostrar ayuda / Show help
subscribe - Suscribirse a una estación / Subscribe to a station
unsubscribe - Cancelar suscripción / Unsubscribe
list - Ver mis suscripciones / View my subscriptions
alert - Configurar alertas / Configure alerts
precio - Consultar precio actual / Check current price
cerca - Estaciones cercanas / Nearby stations
reporte - Generar reporte / Generate report
configuracion - Ajustes / Settings
```

```
/setuserpic
```

Upload a logo image (optional but recommended)

### 4. Test Your Bot

1. Search for your bot username in Telegram
2. Start a conversation
3. Send `/start` - it won't respond yet (needs backend)

### 5. Save Configuration

Add to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_WEBHOOK_SECRET=generate_random_32_char_string
```

Generate webhook secret:

```bash
openssl rand -hex 32
```

### 6. Webhook Setup (After Backend Deployment)

Once your Laravel API is deployed, set the webhook:

```bash
# Replace with your actual values
BOT_TOKEN="YOUR_BOT_TOKEN"
WEBHOOK_URL="https://api.fuelintel.mx/api/telegram/webhook"
WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET"

# Set webhook
curl -F "url=$WEBHOOK_URL" \
     -F "secret_token=$WEBHOOK_SECRET" \
     https://api.telegram.org/bot$BOT_TOKEN/setWebhook

# Verify webhook
curl https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo
```

### 7. Bot Commands Implementation

The bot will support these commands:

| Command        | Spanish     | English     | Function                         |
| -------------- | ----------- | ----------- | -------------------------------- |
| /start         | Iniciar     | Start       | Welcome message and registration |
| /help          | Ayuda       | Help        | Show available commands          |
| /subscribe     | Suscribir   | Subscribe   | Subscribe to station alerts      |
| /unsubscribe   | Desuscribir | Unsubscribe | Remove subscription              |
| /list          | Listar      | List        | Show user's subscriptions        |
| /alert         | Alerta      | Alert       | Configure price alerts           |
| /precio        | Precio      | Price       | Check current price              |
| /cerca         | Cerca       | Nearby      | Find nearby stations             |
| /reporte       | Reporte     | Report      | Generate price report            |
| /configuracion | Config      | Settings    | User preferences                 |

### 8. Testing Checklist

- [ ] Bot created successfully
- [ ] Token saved in `.env`
- [ ] Description and commands set
- [ ] Bot accessible via search
- [ ] `/start` command works (shows in chat)
- [ ] Webhook secret generated
- [ ] Configuration documented

### 9. Advanced Features (Optional)

**Inline Mode:**

```
/setinline
```

Enable inline queries for quick price checks

**Join Groups:**

```
/setjoingroups
```

Choose: Enable or Disable

**Privacy Mode:**

```
/setprivacy
```

Choose based on requirements

### Common Issues

**Bot not responding:**

- Check token is correct
- Verify webhook URL
- Check SSL certificate
- Review Laravel logs

**Commands not showing:**

- Re-run `/setcommands`
- Restart Telegram app
- Clear Telegram cache

**Webhook errors:**

- Ensure HTTPS with valid SSL
- Check webhook secret matches
- Verify Laravel route exists

### Security Notes

1. **Never share your bot token**
2. **Use webhook secret for verification**
3. **Implement rate limiting**
4. **Log suspicious activity**
5. **Regular token rotation**

### Next Steps

1. Implement webhook endpoint in Laravel
2. Add BotMan package to Laravel
3. Create command handlers
4. Test with real users
5. Monitor usage in analytics

---

## Quick Copy Commands

For easy copy-paste to BotFather:

```
/newbot
FuelIntel Bot
FuelIntelBot

/setdescription
🚗 FuelIntel - Track Mexican gas prices in real-time
Get instant alerts when prices change at your favorite stations

/setcommands
start - Iniciar bot / Start bot
help - Mostrar ayuda / Show help
subscribe - Suscribirse a una estación
list - Ver mis suscripciones
alert - Configurar alertas de precio
precio - Consultar precio actual
cerca - Buscar estaciones cercanas
```
