"""Schema introspection tool - fetches the GraphQL schema from the backend and saves it locally.

Usage: python -m cli.core.introspect <backend_url>
This generates src/cli/generated/schema.graphql for type checking.
"""

from __future__ import annotations

import asyncio
import sys

import httpx


INTEOSPECTION_QUERY = """
query IntrospectionQuery {
    __schema {
        queryType { name }
        mutationType { name }
        types {
            ...FullType
        }
        directives {
            name
            description
            locations
            args {
                ...InputValue
            }
        }
    }
}

fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
        name
        description
        args {
            ...InputValue
        }
        type { ...TypeRef }
        isDeprecated
        deprecationReason
    }
    inputFields {
        ...InputValue
    }
    interfaces {
        ...TypeRef
    }
    enumValues(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
    }
    possibleTypes { ...TypeRef }
}

fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
}

fragment TypeRef on __Type {
    kind
    name
    ofType {
        kind
        name
        ofType {
            kind
            name
            ofType {
                kind
                name
                ofType {
                    kind
                    name
                    ofType {
                        kind
                        name
                        ofType {
                            kind
                            name
                            ofType {
                                kind
                                name
                            }
                        }
                    }
                }
            }
        }
    }
}
"""


async def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{url.rstrip('/')}/graphql",
            json={"query": INTEOSPECTION_QUERY},
        )
        resp.raise_for_status()
        data = resp.json()

    schema_doc = data["data"]["__schema"]
    print(schema_doc)  # type: ignore[literal-required]


if __name__ == "__main__":
    asyncio.run(main())
