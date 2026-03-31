local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clear_before = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)
local amount = redis.call('ZCARD', key)

if amount < limit then
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, window)
    return 0
else
    return 1
end