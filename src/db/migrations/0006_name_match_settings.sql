-- Adds the name-matching cut-offs as a new settings version, so earlier versions stay as they were.
-- A fresh database has no settings yet; the seed then inserts version 1 with these values.
INSERT INTO "scoring_settings" ("version", "settings")
SELECT "version" + 1, "settings" || '{"nameMatch": {"matchBps": 9500, "possibleMatchBps": 8500}}'::jsonb
FROM (SELECT "version", "settings" FROM "scoring_settings" ORDER BY "version" DESC LIMIT 1) AS "latest"
WHERE NOT ("settings" ? 'nameMatch');
