import strawberry

BigInt = strawberry.scalar(
    int,
    description="Arbitrarily large integer",
    serialize=lambda v: int(v),
    parse_value=lambda v: int(v),
)
