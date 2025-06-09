# Case Law Web Scraper

A high-performance web scraping system for legal case databases. Currently optimized for Danish case law from MFKN (Miljø- og Fødevareklagenævnet).

## Architecture

### Current: Monolithic Approach

- **Atomic Operations**: Indexing and enrichment in single process
- **Fast Development**: Simplified deployment and debugging
- **Performance**: ~1.8-3.3 seconds for 10 cases

### Future: Producer/Consumer Pattern

To improve performance and scalability, I would for the future plan to **separate the indexer and enricher** into distinct modules, then eventually into separate services, following a producer/consumer pattern.

This would allow for independent scaling of the indexer and enricher, and would allow for the use of message queues to handle the flow of cases and content.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Producers     │    │   Message       │    │   Consumers     │
│   (Indexers)    │───▶│   Queue         │───▶│   (Enrichers)   │
│                 │    │   (Redis/RMQ)   │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Source A     │ │    │ │   Cases     │ │    │ │Content      │ │
│ │Source B     │ │    │ │   Queue     │ │    │ │Enricher     │ │
│ │Source C     │ │    │ └─────────────┘ │    │ └─────────────┘ │
│ └─────────────┘ │    └─────────────────┘    └─────────────────┘
└─────────────────┘
```

**Scaling Strategy:**

1. **Phase 1**: Split into separate modules within the same service
2. **Phase 2**: Deploy as independent microservices with message queues
3. **Benefits**: Independent scaling, fault isolation, resource optimization

## Technology Stack

- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL with TypeORM
- **Scraping**: Puppeteer and Cheerio
- **Containerization**: Docker & Docker Compose

## Setup

### Hybrid Approach (Recommended)

**Database**: Runs in Docker container for easy setup
**Application**: Runs locally with npm for better Puppeteer compatibility

```bash
git clone https://github.com/KristofferTolboll2/law-case-web-scraper.git
cd case-law-web-scraper

# Start PostgreSQL database in Docker
docker-compose up -d postgres

# Setup and run application locally
npm install
npm run migration:run  # Run database migrations
npm run start:dev
```

> **Note**: While a full Docker setup is available (`docker-compose up -d`), we decided on only hosting the database in Docker and running the service with regular `npm run start:dev`. This is because there were some further configurations that would be needed to get Puppeteer running properly in Docker (such as installing additional dependencies, configuring headless browser settings, handling sandbox restrictions, and managing Chrome binary paths), so we decided to focus more on the functionality rather than solving Docker containerization complexities for web scraping.

### Alternative: Full Docker Setup

```bash
# Full containerized setup (may require additional Puppeteer configuration)
docker-compose up -d
```

### Manual Database Setup

```bash
# If you prefer running PostgreSQL locally
docker run -d --name case-law-postgres \
  -e POSTGRES_DB=caselaw \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:15

# Setup application
npm install
npm run migration:run  # Run database migrations
npm start
```

## API Usage

### Start Indexing

```bash
# Index 1 batch (10 cases)
curl -X POST http://localhost:3000/indexing/start \
  -H "Content-Type: application/json" \
  -d '{"batches": 1}'
```

### Get Statistics

```bash
curl http://localhost:3000/api/statistics
```

### Monitor Status

```bash
curl http://localhost:3000/indexing/status
```

## Database

PostgreSQL with TypeORM for cases and case content storage. Run migrations with:

```bash
npm run migration:run       # Run pending migrations
npm run migration:generate  # Create new migrations
npm run migration:revert    # Rollback last migration
```

## Performance

| Operation  | Time  | Cases    |
| ---------- | ----- | -------- |
| New cases  | ~1.8s | 10 cases |
| Duplicates | ~3.3s | 10 cases |
| 3 batches  | ~5-8s | 30 cases |

**Performance Improvements:**

- **Removed all artificial delays** (200ms + 2000ms waits eliminated)
- **Full parallel processing** (all cases process simultaneously)
- **UPSERT database operations** (automatic duplicate handling)
- **Optimized page loading** (`domcontentloaded` vs `networkidle0`)
- **Single optimized query** for statistics (6 queries → 1)
- **Performance increased many times** through optimization techniques

## Development

```bash
# Development
npm run start:dev
npm run build

# Database
npm run migration:generate
npm run migration:run

# Testing
npm run test
npm run test:e2e
```

**Built for scalable legal data extraction**
