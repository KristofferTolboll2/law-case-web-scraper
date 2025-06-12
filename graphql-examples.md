# GraphQL Examples for Case Law API

## Endpoint

```
POST http://localhost:3000/graphql
Content-Type: application/json
```

## Example 1: Get all cases with pagination

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { cases(query: { page: 1, limit: 5 }) { data { id title caseNumber decisionDate } meta { total page totalPages hasNextPage } } }"
  }'
```

## Example 2: Search for cases containing specific text

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { cases(query: { search: \"miljø\", limit: 3 }) { data { id title caseNumber decisionDate sourceUrl } meta { total } } }"
  }'
```

## Example 3: Get a specific case by ID

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { caseById(id: \"YOUR_CASE_ID_HERE\") { id title caseNumber decisionDate content { court parties keywords } } }"
  }'
```

## Example 4: Get a case by MFKN ID

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { caseByMfknId(mfknId: \"YOUR_MFKN_ID_HERE\") { id title caseNumber decisionDate sourceUrl } }"
  }'
```

## Example 5: Complex query with date filtering

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { cases(query: { fromDate: \"2024-01-01\", toDate: \"2024-12-31\", sortBy: \"decisionDate\", sortOrder: \"desc\", limit: 10 }) { data { id title caseNumber decisionDate content { court fullText } } meta { total page totalPages } } }"
  }'
```

## GraphQL Playground Alternative (Pretty Format)

You can also test these queries in a more readable format:

### Query 1: Basic Case List

```graphql
query {
  cases(query: { page: 1, limit: 5 }) {
    data {
      id
      title
      caseNumber
      decisionDate
      sourceUrl
    }
    meta {
      total
      page
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
}
```

### Query 2: Case with Full Content

```graphql
query {
  cases(query: { limit: 2 }) {
    data {
      id
      title
      caseNumber
      decisionDate
      content {
        court
        parties
        keywords
        links {
          text
          url
          type
        }
        paragraphs
      }
    }
  }
}
```

### Query 3: Search with Filters

```graphql
query {
  cases(
    query: {
      search: "projektstøtte"
      fromDate: "2025-01-01"
      sortBy: "decisionDate"
      sortOrder: "desc"
      limit: 5
    }
  ) {
    data {
      id
      title
      caseNumber
      decisionDate
      content {
        court
        keywords
      }
    }
    meta {
      total
      page
    }
  }
}
```

## Testing the Schema

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ __schema { queryType { fields { name type { name } } } } }"
  }'
```

## Available Query Fields

- `cases(query: CaseQueryInput)` - Get paginated list of cases
- `caseById(id: ID!)` - Get a specific case by internal ID
- `caseByMfknId(mfknId: String!)` - Get a case by its MFKN ID
