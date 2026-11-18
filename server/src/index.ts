import { createApp } from './app.js'
import { config } from './config.js'
import { migrate } from './db/migrate.js'

await migrate()

const app = createApp()

app.listen(config.port, () => {
  console.log(`API http://localhost:${config.port}`)
})
