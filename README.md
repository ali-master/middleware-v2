# Radar Microservice
Radar Microservice is a microservice
that provides a RESTful API for HealthCheck and Documentation page and also a [SSE Protocol](https://en.wikipedia.org/wiki/Server-sent_events)
for managing and broadcasting market tokens price changes in real-time to the Connected Clients.
Price changes are published to the Redis Pub/Sub Channel by the PriceEngine Microservice and Radar create a subscribe connection to the Redis and read the changes and broadcast the changes if needed.

## Requirements
- *[Bun](https://bun.sh)
- [Docker](https://www.docker.com)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Infisical Token](https://vault.lazarus.ir): Your Personal Vault Access Token to load the system environment keys

## Getting Started
To get started with this microservice, simply paste this command into your terminal:
```bash
$ bun install\
  && cp -R .env.example .env.development.local
```

## Development
To start the Production server, run:
```bash
$ bun run dev
```

## Production
To start the Development server, run:
```bash
$ bun run build\
  && bun run start
```

## Running in Docker
To run this microservice in Docker, run:
```bash
docker-compose up -d
```

Open http://localhost:4045/api/v1/docs/ with your browser to see the result.
