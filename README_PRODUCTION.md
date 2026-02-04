# 🚀 Production Deployment Guide

## Infrastructure

- **Database**: Supabase PostgreSQL
- **Cache/Queue**: Upstash Redis
- **Hosting**: Render/Railway (to be configured)

## Quick Start Production

1. **Setup Environment:**

```bash
cp .env.production.example .env.production
# Edit .env.production with your credentials
```

1. **Test Connections:**

```bash
npm run check:supabase
```

1. **Run Migrations:**

```bash
npm run migrate:supabase
```

1. **Start Production Server:**

```bash
npm run prod:all
```

## Connection Details

### Supabase (PostgreSQL)

- **URL**: postgresql://postgres:****@db.hxaexxuvlfwihlrxheaq.supabase.co:5432/postgres
- **SSL**: Required

### Upstash (Redis)

- **URL**: rediss://default:****@quick-hawk-63265.upstash.io:6379
- **TLS**: Enabled

## Monitoring

### Check Database Health

```bash
npm run check:supabase
```

### View Connection Status

- **Supabase Dashboard**: <https://app.supabase.com>
- **Upstash Dashboard**: <https://console.upstash.com>

### Logs

- **Application logs**: Check your hosting platform
- **Database logs**: Supabase Dashboard → Logs
- **Redis logs**: Upstash Dashboard → Monitoring

## Security Notes

- **JWT Secret**: Generate a strong one: `openssl rand -base64 32`
- **Database Credentials**: Rotate periodically in Supabase
- **Redis Password**: Manage in Upstash dashboard
- **Environment Variables**: Never commit to Git

## Troubleshooting

### Connection Issues

- Check firewall rules in Supabase
- Verify IP whitelisting
- Test with `npm run check:supabase`

### Migration Issues

- Run migrations manually in Supabase SQL Editor
- Check `sql/schema.sql` for syntax errors

### Performance Issues

- Check query logs in Supabase
- Monitor Redis memory usage in Upstash
