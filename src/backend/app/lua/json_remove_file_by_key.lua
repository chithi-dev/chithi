local raw = redis.call('JSON.GET', KEYS[1], '$.files')
if not raw then return nil end
local outer = cjson.decode(raw)
local files = outer[1]
for i, f in ipairs(files) do
    if f['key'] == ARGV[1] then
        local removed = cjson.encode(f)
        redis.call('JSON.DEL', KEYS[1], '$.files[' .. (i-1) .. ']')
        return removed
    end
end
return nil