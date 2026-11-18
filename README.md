# Ателье

Сервис записи на услуги. Клиент выбирает услугу, специалиста и свободное время. Администратор ведёт каталог, недельный график и выходные, видит все брони и может отменить любую. Уведомления о новых записях и отменах приходят в ленту внутри приложения.

## Стек

- Клиент: TypeScript, React 19, Vite, Tailwind CSS
- Сервер: TypeScript, Node.js, Express
- База: PostgreSQL 16

## Запуск

Нужны Node.js 22+ и Docker.

```powershell
npm install
Copy-Item .env.example .env
npm run db:up
npm run seed
npm run dev
```

Клиент открывается на http://localhost:5173, API слушает http://localhost:4000. Запросы `/api` проксируются Vite, поэтому refresh-токен остаётся на том же origin.

В bash вместо `Copy-Item` используйте `cp .env.example .env`.

Остановить базу: `npm run db:down`.

## Демо-доступ

Регистрация создаёт только клиента. Администратор появляется из сида.

| Роль | Email | Пароль |
| --- | --- | --- |
| Администратор | admin@atelier.local | Admin12345 |
| Клиент | client@atelier.local | Client12345 |

Повторный `npm run seed` обновляет каталог, специалистов, пароли и недельный график. Уже созданные записи и выходные дни не удаляются. Демо-записи Марии Соколовой добавляются только если у неё ещё нет броней.

## Правила записи

Часовой пояс салона — `Europe/Moscow`. Деньги хранятся в копейках.

- Сетка слотов — 15 минут. Услуга должна целиком поместиться в рабочие часы специалиста.
- Слот раньше чем через 15 минут не предлагается.
- Выходной, нерабочий день и пересечение с подтверждённой записью слот убирают.
- Двойную запись закрывает exclusion constraint PostgreSQL по специалисту и диапазону времени. Второе бронирование того же интервала получает 409.
- Клиент отменяет свою запись не позднее чем за `CANCEL_BEFORE_HOURS` (по умолчанию 2) до начала. Администратор отменяет в любой момент. Отмена освобождает слот.
- Смена недельного графика не отменяет уже созданные записи.
- Закрыть день нельзя, пока на него есть подтверждённые записи.
- Неделя в графике считается с понедельника: 1 — понедельник, 7 — воскресенье.

## Переменные окружения

Смотрите [.env.example](.env.example).

- `DATABASE_URL` — строка подключения PostgreSQL
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — секреты не короче 16 символов
- `CLIENT_ORIGIN` — origin клиента для CORS
- `APP_TIMEZONE` — часовой пояс салона
- `PORT` — порт API
- `CANCEL_BEFORE_HOURS` — за сколько часов клиент ещё может отменить запись

Access-токен живёт 15 минут и хранится в памяти вкладки. Refresh-токен — httpOnly cookie на 30 дней, в базе лежит только его хеш. При обновлении сессии старый refresh отзывается.

## API

- `GET /api/meta` — часовой пояс, шаг сетки и порог отмены
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/services`, `GET /api/services/:id`, `POST /api/services`, `PATCH /api/services/:id`
- `GET /api/specialists`, `GET /api/specialists/:id`, `POST /api/specialists`, `PATCH /api/specialists/:id`
- `PUT /api/specialists/:id/services`, `PUT /api/specialists/:id/hours`
- `POST /api/specialists/:id/days-off`, `DELETE /api/specialists/:id/days-off/:day`
- `GET /api/slots?specialistId&serviceId&from&to` — не длиннее 31 дня
- `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings`, `POST /api/bookings/:id/cancel`
- `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`

Запись и изменение каталога доступны администратору. Создать бронь может только клиент. Ошибка приходит как `{ "error": { "code", "message" } }`.

## Тесты

```powershell
npm test
```

Проверяются генерация слотов и правило отмены. База для этих тестов не нужна.

## Скрипты

- `npm run dev` — API и клиент
- `npm run seed` — демо-данные
- `npm run test` — тесты сервера
- `npm run build` — сборка обоих пакетов
- `npm run db:up` / `npm run db:down` — PostgreSQL
