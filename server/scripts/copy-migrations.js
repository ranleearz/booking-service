import fs from 'node:fs'

fs.mkdirSync('dist/db', { recursive: true })
fs.cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true })
