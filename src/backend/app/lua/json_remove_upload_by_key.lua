local raw = redis.call('JSON.GET', KEYS[1], '$.active_uploads')
if not raw then return nil end
local outer = cjson.decode(raw)
local uploads = outer[1]
for i, u in ipairs(uploads) do
    if u['upload_key'] == ARGV[1] then
        redis.call('JSON.DEL', KEYS[1], '$.active_uploads[' .. (i-1) .. ']')
        return 1
    end
end
return nil