# Case Law Web Scraper

A high-performance web scraping system for legal case databases. Currently optimized for Danish case law from MFKN (Miljø- og Fødevareklagenævnet).

## 🏗️ Architecture

### Current: Monolithic Approach

- **Atomic Operations**: Indexing and enrichment in single process
- **Fast Development**: Simplified deployment and debugging
- **Performance**: ~1.8-3.3 seconds for 10 cases

### Future: Producer/Consumer Pattern

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

**Benefits**: Horizontal scaling, fault tolerance, multi-source support

## 🔧 Technology Stack

- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL with TypeORM
- **Scraping**: Puppeteer with zero artificial delays
- **Containerization**: Docker & Docker Compose

## 📦 Setup

### Docker (Recommended)

```bash
git clone https://github.com/KristofferTolboll2/law-case-web-scraper.git
cd case-law-web-scraper
docker-compose up -d
```

### Local Development

```bash
# Start PostgreSQL
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

## 🚀 API Usage

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

## 🗄️ Database

PostgreSQL with TypeORM for cases and case content storage. Run migrations with:

```bash
npm run migration:run       # Run pending migrations
npm run migration:generate  # Create new migrations
npm run migration:revert    # Rollback last migration
```

## 📊 Performance

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
- **3.3x faster** than original implementation

## 🛠️ Development

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

**Built for scalable legal data extraction** 🏛️⚖️
